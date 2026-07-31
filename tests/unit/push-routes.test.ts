import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPlayer: vi.fn(),
  findSubscription: vi.fn(),
  createSubscription: vi.fn(),
  countSubscriptions: vi.fn(),
  updateSubscriptions: vi.fn(),
  deleteSubscriptions: vi.fn(),
  findSubscriptions: vi.fn(),
  transaction: vi.fn(),
  findCheckins: vi.fn(),
  rateLimit: vi.fn(),
  sendPushNotification: vi.fn(),
  logError: vi.fn(),
  getPlayerPortalSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    player: {
      findFirst: mocks.findPlayer,
    },
    pushSubscription: {
      findUnique: mocks.findSubscription,
      create: mocks.createSubscription,
      count: mocks.countSubscriptions,
      updateMany: mocks.updateSubscriptions,
      deleteMany: mocks.deleteSubscriptions,
      findMany: mocks.findSubscriptions,
    },
    healthCheck: {
      findMany: mocks.findCheckins,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/player-session", () => ({
  getPlayerPortalSession: mocks.getPlayerPortalSession
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: mocks.sendPushNotification,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.logError,
  },
}));

vi.mock("@/lib/utils", () => ({
  todayIsoDate: () => "2026-07-24",
}));

import {
  DELETE as unsubscribe,
  POST as subscribe
} from "@/app/api/push/subscribe/route";
import {
  GET as runDailyPush,
  POST as runDailyPushManually,
} from "@/app/api/push/daily/route";

const ACCESS_TOKEN = "11111111-1111-4111-8111-111111111111";
const OTHER_ACCESS_TOKEN = "22222222-2222-4222-8222-222222222222";
const originalCronSecret = process.env.CRON_SECRET;

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
  keys: {
    p256dh: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-",
    auth: "aBcDeFgHiJkLmNoP",
  },
};

function jsonRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function cronRequest(method: "GET" | "POST" = "GET", secret = "cron-secret") {
  return new Request("https://coachos.test/api/push/daily", {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret";
  mocks.getPlayerPortalSession.mockResolvedValue({
    id: "session-1",
    playerId: "server-player-id",
    player: {
      id: "server-player-id",
      workspaceId: "workspace-1",
      accessToken: ACCESS_TOKEN
    }
  });
  mocks.rateLimit.mockResolvedValue({
    success: true,
    limit: 30,
    remaining: 29,
    reset: Date.now() + 60_000,
  });
  mocks.findPlayer.mockResolvedValue({ id: "server-player-id" });
  mocks.findSubscription.mockResolvedValue(null);
  mocks.createSubscription.mockResolvedValue({ id: "subscription-id" });
  mocks.countSubscriptions.mockResolvedValue(0);
  mocks.updateSubscriptions.mockResolvedValue({ count: 1 });
  mocks.deleteSubscriptions.mockResolvedValue({ count: 1 });
  mocks.findSubscriptions.mockResolvedValue([]);
  mocks.findCheckins.mockResolvedValue([]);
  mocks.sendPushNotification.mockResolvedValue(true);
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      pushSubscription: {
        findUnique: mocks.findSubscription,
        create: mocks.createSubscription,
        count: mocks.countSubscriptions,
        updateMany: mocks.updateSubscriptions,
      },
    })
  );
});

afterAll(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("POST /api/push/subscribe", () => {
  it("ignores the old client-controlled playerId contract", async () => {
    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        playerId: "attacker-selected-player",
        subscription,
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.findPlayer).not.toHaveBeenCalled();
    expect(mocks.createSubscription).toHaveBeenCalledWith({
      data: expect.objectContaining({ playerId: "server-player-id" })
    });
  });

  it("rejects malformed endpoints and keys before touching the database", async () => {
    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription: {
          endpoint: "http://push.example.test/not-secure",
          keys: { p256dh: "not valid!", auth: "short" },
        },
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.findPlayer).not.toHaveBeenCalled();
  });

  it("rejects arbitrary HTTPS endpoints to prevent server-side request forgery", async () => {
    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription: {
          ...subscription,
          endpoint: "https://attacker.example/internal-target",
        },
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.findPlayer).not.toHaveBeenCalled();
    expect(mocks.createSubscription).not.toHaveBeenCalled();
  });

  it("rejects a missing device session", async () => {
    mocks.getPlayerPortalSession.mockResolvedValue(null);

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription,
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid session" });
    expect(mocks.createSubscription).not.toHaveBeenCalled();
  });

  it("derives playerId from the validated device session", async () => {
    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN.toUpperCase(),
        subscription,
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.findPlayer).not.toHaveBeenCalled();
    expect(mocks.findSubscription).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint },
      select: {
        playerId: true,
        p256dh: true,
        auth: true
      }
    });
    expect(mocks.createSubscription).toHaveBeenCalledWith({
      data: {
        playerId: "server-player-id",
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a generic conflict instead of moving an endpoint silently", async () => {
    mocks.findSubscription.mockResolvedValue({
      playerId: "different-player-id",
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    });

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "Subscription conflict",
      code: "subscription_conflict"
    });
    expect(JSON.stringify(body)).not.toContain("different-player-id");
    expect(JSON.stringify(body)).not.toContain(ACCESS_TOKEN);
    expect(mocks.createSubscription).not.toHaveBeenCalled();
    expect(mocks.updateSubscriptions).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("also returns a conflict when another player wins a concurrent create", async () => {
    mocks.findSubscription
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        playerId: "different-player-id",
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      });
    mocks.createSubscription.mockRejectedValueOnce(
      Object.assign(new Error("unique endpoint constraint"), { code: "P2002" })
    );

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Subscription conflict",
      code: "subscription_conflict"
    });
    expect(mocks.findSubscription).toHaveBeenCalledTimes(2);
    expect(mocks.updateSubscriptions).not.toHaveBeenCalled();
  });

  it("enforces a bounded number of active devices per player", async () => {
    mocks.countSubscriptions.mockResolvedValue(5);

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Subscription device limit reached",
      code: "device_limit"
    });
    expect(mocks.createSubscription).not.toHaveBeenCalled();
  });

  it("applies an additional per-token rate limit", async () => {
    mocks.rateLimit
      .mockResolvedValueOnce({
        success: true,
        limit: 30,
        remaining: 29,
        reset: Date.now() + 60_000
      })
      .mockResolvedValueOnce({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 5_000
      });

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription
      })
    );

    expect(response.status).toBe(429);
    expect(mocks.findPlayer).not.toHaveBeenCalled();
  });

  it("moves an endpoint only after an explicit replacement request", async () => {
    mocks.findSubscription.mockResolvedValue({
      playerId: "different-player-id",
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    });

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription,
        replaceExisting: true
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.updateSubscriptions).toHaveBeenCalledWith({
      where: {
        endpoint: subscription.endpoint,
        playerId: "different-player-id",
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      data: {
        playerId: "server-player-id",
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    });
    expect(mocks.createSubscription).not.toHaveBeenCalled();
  });

  it("does not replace an endpoint if its ownership changes during the update", async () => {
    mocks.findSubscription
      .mockResolvedValueOnce({
        playerId: "different-player-id",
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      })
      .mockResolvedValueOnce({
        playerId: "new-player-id",
        p256dh: "rotated-p256dh-key",
        auth: "rotated-auth-key"
      });
    mocks.updateSubscriptions.mockResolvedValueOnce({ count: 0 });

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription,
        replaceExisting: true
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.findSubscription).toHaveBeenCalledTimes(2);
    expect(mocks.updateSubscriptions).toHaveBeenCalledTimes(1);
  });

  it("rejects explicit replacement without matching browser keys", async () => {
    mocks.findSubscription.mockResolvedValue({
      playerId: "different-player-id",
      p256dh: "different-p256dh-key",
      auth: "different-auth-key"
    });

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription,
        replaceExisting: true
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "Subscription conflict",
      code: "subscription_conflict"
    });
    expect(mocks.updateSubscriptions).not.toHaveBeenCalled();
    expect(mocks.createSubscription).not.toHaveBeenCalled();
  });

  it("refreshes keys without changing an endpoint that already belongs to the player", async () => {
    mocks.findSubscription.mockResolvedValue({
      playerId: "server-player-id",
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    });

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.updateSubscriptions).toHaveBeenCalledWith({
      where: {
        endpoint: subscription.endpoint,
        playerId: "server-player-id",
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      data: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    });
  });

  it("applies the route-specific rate limit before parsing or querying", async () => {
    mocks.rateLimit.mockResolvedValue({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 5_000,
    });

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription,
      })
    );

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mocks.findPlayer).not.toHaveBeenCalled();
  });

  it("returns a generic persistence error without database details", async () => {
    mocks.createSubscription.mockRejectedValue(
      new Error("database password and internal host")
    );

    const response = await subscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        subscription,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Subscription could not be saved" });
    expect(JSON.stringify(body)).not.toContain("database password");
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/push/subscribe", () => {
  it("removes only the validated player's matching endpoint", async () => {
    const response = await unsubscribe(
      jsonRequest("https://coachos.test/api/push/subscribe", {
        accessToken: ACCESS_TOKEN,
        endpoint: subscription.endpoint
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteSubscriptions).toHaveBeenCalledWith({
      where: {
        endpoint: subscription.endpoint,
        playerId: "server-player-id"
      }
    });
  });
});

describe("/api/push/daily", () => {
  it("rejects GET without the configured bearer secret", async () => {
    const response = await runDailyPush(
      new Request("https://coachos.test/api/push/daily")
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.findSubscriptions).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await runDailyPush(cronRequest());

    expect(response.status).toBe(401);
    expect(mocks.findSubscriptions).not.toHaveBeenCalled();
  });

  it("sends only to players without today's check-in and returns aggregate counts", async () => {
    mocks.findSubscriptions.mockResolvedValue([
      {
        id: "subscription-1",
        playerId: "checked-player",
        endpoint: "https://fcm.googleapis.com/fcm/send/checked",
        p256dh: "checked-p256dh",
        auth: "checked-auth",
        player: {
          firstName: "Checked",
          name: "Checked Player",
          accessToken: ACCESS_TOKEN,
        },
      },
      {
        id: "subscription-2",
        playerId: "pending-player",
        endpoint: "https://fcm.googleapis.com/fcm/send/pending",
        p256dh: "pending-p256dh",
        auth: "pending-auth",
        player: {
          firstName: "Pending",
          name: "Pending Player",
          accessToken: OTHER_ACCESS_TOKEN,
        },
      },
    ]);
    mocks.findCheckins.mockResolvedValue([{ playerId: "checked-player" }]);

    const response = await runDailyPush(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ sent: 1, attempted: 1 });
    expect(mocks.sendPushNotification).toHaveBeenCalledOnce();
    expect(mocks.sendPushNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/pending",
        p256dh: "pending-p256dh",
        auth: "pending-auth",
      },
      expect.objectContaining({
        url: "/player",
      })
    );
    expect(JSON.stringify(body)).not.toContain(OTHER_ACCESS_TOKEN);
    expect(JSON.stringify(body)).not.toContain("pending-player");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps authenticated POST as a compatibility entry point", async () => {
    const response = await runDailyPushManually(cronRequest("POST"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 0, attempted: 0 });
  });

  it("does not return internal query errors", async () => {
    mocks.findSubscriptions.mockRejectedValue(
      new Error(`query exposed ${ACCESS_TOKEN}`)
    );

    const response = await runDailyPush(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Push job failed" });
    expect(JSON.stringify(body)).not.toContain(ACCESS_TOKEN);
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});
