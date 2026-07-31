import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  playerFindFirst: vi.fn(),
  playerCount: vi.fn(),
  playerCreate: vi.fn(),
  playerUpdate: vi.fn(),
  coachMessageUpdateMany: vi.fn(),
  trainingCount: vi.fn(),
  matchCount: vi.fn(),
  availabilityUpsert: vi.fn(),
  revalidatePath: vi.fn(),
  headers: vi.fn(),
  rateLimit: vi.fn(),
  getPlayerPortalSession: vi.fn(),
  recordAuditEvent: vi.fn(),
  resolvePlayerSignupInvite: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers
}));

vi.mock("@/lib/db", () => ({
  db: {
    player: {
      findFirst: mocks.playerFindFirst,
      count: mocks.playerCount,
      create: mocks.playerCreate,
      update: mocks.playerUpdate
    },
    coachMessage: {
      updateMany: mocks.coachMessageUpdateMany
    },
    training: {
      count: mocks.trainingCount
    },
    match: {
      count: mocks.matchCount
    },
    availabilityResponse: {
      upsert: mocks.availabilityUpsert
    },
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/invites", () => ({
  resolvePlayerSignupInvite: mocks.resolvePlayerSignupInvite
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit
}));

vi.mock("@/lib/player-session", () => ({
  getPlayerPortalSession: mocks.getPlayerPortalSession
}));

vi.mock("@/lib/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent
}));

import {
  markCoachMessageRead,
  selfRegisterPlayer,
  submitAvailability,
  submitPublicSeasonForm
} from "@/app/actions-public";

const accessToken = "11111111-1111-4111-8111-111111111111";
const playerId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const messageId = "44444444-4444-4444-8444-444444444444";

function mockTokenPlayer() {
  mocks.playerFindFirst.mockResolvedValue({
    id: playerId,
    workspaceId,
    accessToken,
    name: "Test Player",
    firstName: "Test",
    lastName: "Player"
  });
}

describe("public player actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenPlayer();
    mocks.getPlayerPortalSession.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      playerId,
      player: { id: playerId, workspaceId, name: "Test Player", accessToken }
    });
    mocks.headers.mockResolvedValue(
      new Headers({ "x-forwarded-for": "203.0.113.10" })
    );
    mocks.rateLimit.mockResolvedValue({
      success: true,
      limit: 40,
      remaining: 39,
      reset: Date.now() + 60_000
    });
    mocks.resolvePlayerSignupInvite.mockResolvedValue({
      workspaceId,
      workspaceName: "Test Team",
      ageGroup: "U16",
      season: "2026/27"
    });
    mocks.playerCount.mockResolvedValue(12);
    mocks.playerCreate.mockResolvedValue({
      id: playerId,
      accessToken
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        player: {
          count: mocks.playerCount,
          create: mocks.playerCreate
        }
      })
    );
  });

  it("scopes a read receipt to the player authenticated by the device session", async () => {
    mocks.coachMessageUpdateMany.mockResolvedValue({ count: 1 });

    await markCoachMessageRead(messageId);

    expect(mocks.coachMessageUpdateMany).toHaveBeenCalledWith({
      where: {
        id: messageId,
        playerId
      },
      data: {
        readAt: expect.any(Date)
      }
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/player");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/players/${playerId}`);
  });

  it("rejects a message that does not belong to the authenticated player", async () => {
    mocks.coachMessageUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      markCoachMessageRead(messageId)
    ).rejects.toThrow("Mitteilung wurde nicht gefunden.");

    expect(mocks.coachMessageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: messageId,
          playerId
        }
      })
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("stores availability only for an event in the player's workspace", async () => {
    const eventId = "66666666-6666-4666-8666-666666666666";
    mocks.trainingCount.mockResolvedValue(1);
    mocks.availabilityUpsert.mockResolvedValue({ id: "response-1" });
    const formData = new FormData();
    formData.set("event_id", eventId);
    formData.set("event_type", "TRAINING");
    formData.set("status", "YES");

    await submitAvailability(formData);

    expect(mocks.trainingCount).toHaveBeenCalledWith({
      where: { id: eventId, workspaceId }
    });
    expect(mocks.availabilityUpsert).toHaveBeenCalledWith({
      where: {
        playerId_eventType_eventId: {
          playerId,
          eventType: "TRAINING",
          eventId
        }
      },
      create: {
        workspaceId,
        playerId,
        eventType: "TRAINING",
        eventId,
        status: "YES",
        comment: null
      },
      update: {
        status: "YES",
        comment: null,
        respondedAt: expect.any(Date)
      },
      select: { id: true }
    });
  });

  it("rejects availability for a foreign or missing event", async () => {
    mocks.matchCount.mockResolvedValue(0);
    const formData = new FormData();
    formData.set(
      "event_id",
      "77777777-7777-4777-8777-777777777777"
    );
    formData.set("event_type", "MATCH");
    formData.set("status", "NO");

    await expect(submitAvailability(formData)).rejects.toThrow(
      "Termin wurde nicht gefunden"
    );
    expect(mocks.availabilityUpsert).not.toHaveBeenCalled();
  });

  it("does not accept medical fields through the public season form", async () => {
    mocks.playerUpdate.mockResolvedValue({ id: playerId });
    const formData = new FormData();
    formData.set("contact", "player@example.com");
    formData.set("favorite_team", "FC Test");
    formData.set("football_goals", "Mehr Spielübersicht");
    formData.set("allergies", "sensitive allergy");
    formData.set("injuries", "sensitive injury");
    formData.set("limitations", "sensitive limitation");
    formData.set("medications", "sensitive medication");

    await submitPublicSeasonForm(formData);

    const update = mocks.playerUpdate.mock.calls[0]?.[0];
    expect(update.where).toEqual({ id: playerId });
    expect(update.data).toMatchObject({
      contact: "player@example.com",
      favoriteTeam: "FC Test",
      footballGoals: "Mehr Spielübersicht",
      seasonFormCompletedAt: expect.any(Date)
    });
    expect(update.data).not.toHaveProperty("allergies");
    expect(update.data).not.toHaveProperty("injuries");
    expect(update.data).not.toHaveProperty("limitations");
    expect(update.data).not.toHaveProperty("medications");
  });

  it("rejects manipulated public select values", async () => {
    const formData = new FormData();
    formData.set("strong_foot", "sideways");

    await expect(
      submitPublicSeasonForm(formData)
    ).rejects.toThrow("Starker Fuss");
    expect(mocks.playerUpdate).not.toHaveBeenCalled();
  });
});

describe("public player registration abuse protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(
      new Headers({ "x-forwarded-for": "203.0.113.10" })
    );
    mocks.resolvePlayerSignupInvite.mockResolvedValue({
      workspaceId,
      workspaceName: "Test Team",
      ageGroup: "U16",
      season: "2026/27"
    });
    mocks.rateLimit.mockResolvedValue({
      success: true,
      limit: 40,
      remaining: 39,
      reset: Date.now() + 60_000
    });
    mocks.playerCount.mockResolvedValue(12);
    mocks.playerCreate.mockResolvedValue({ id: playerId, accessToken });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        player: {
          count: mocks.playerCount,
          create: mocks.playerCreate
        }
      })
    );
  });

  function registrationForm() {
    const formData = new FormData();
    formData.set("consent", "on");
    formData.set("parent_contact", "parent@example.com");
    formData.set("first_name", "Test");
    formData.set("last_name", "Player");
    return formData;
  }

  it("applies shared IP and workspace limits before creating a player", async () => {
    await selfRegisterPlayer("team-invite", registrationForm());

    expect(mocks.rateLimit).toHaveBeenCalledWith(
      "self-register-ip:203.0.113.10",
      10,
      86_400
    );
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      `self-register-workspace:${workspaceId}`,
      40,
      86_400
    );
    expect(mocks.playerCreate).toHaveBeenCalledOnce();
  });

  it("blocks registration when either shared limit is exhausted", async () => {
    mocks.rateLimit
      .mockResolvedValueOnce({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60_000
      })
      .mockResolvedValueOnce({
        success: true,
        limit: 40,
        remaining: 20,
        reset: Date.now() + 60_000
      });

    await expect(
      selfRegisterPlayer("team-invite", registrationForm())
    ).rejects.toThrow("Zu viele Registrierungen");
    expect(mocks.playerCount).not.toHaveBeenCalled();
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("enforces a hard workspace roster cap", async () => {
    mocks.playerCount.mockResolvedValue(100);

    await expect(
      selfRegisterPlayer("team-invite", registrationForm())
    ).rejects.toThrow("Kaderlimit");
    expect(mocks.playerCreate).not.toHaveBeenCalled();
  });

  it("rejects oversized registration fields server-side", async () => {
    const formData = registrationForm();
    formData.set("first_name", "A".repeat(81));

    await expect(
      selfRegisterPlayer("team-invite", formData)
    ).rejects.toThrow("Vorname ist zu lang");
    expect(mocks.playerCreate).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalledWith(
      `self-register-workspace:${workspaceId}`,
      40,
      86_400
    );
  });
});
