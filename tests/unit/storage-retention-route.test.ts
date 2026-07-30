import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drain: vi.fn(),
  logError: vi.fn()
}));

vi.mock("@/lib/storage-deletion-queue", () => ({
  drainStorageDeletionQueue: mocks.drain
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.logError
  }
}));

import {
  GET,
  POST
} from "@/app/api/storage/retention/route";

const originalCronSecret = process.env.CRON_SECRET;

function request(
  method: "GET" | "POST",
  secret: string | null = "retention-secret"
) {
  return new Request("https://coachos.test/api/storage/retention", {
    method,
    headers: secret
      ? { Authorization: `Bearer ${secret}` }
      : undefined
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "retention-secret";
  mocks.drain.mockResolvedValue({
    claimed: 2,
    deleted: 1,
    referenced: 1,
    retried: 0,
    discarded: 0
  });
});

afterAll(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("/api/storage/retention", () => {
  it("rejects missing and incorrect cron credentials", async () => {
    const missing = await GET(request("GET", null));
    const incorrect = await GET(request("GET", "wrong-secret"));

    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(mocks.drain).not.toHaveBeenCalled();
  });

  it("drains a bounded batch for authenticated GET and POST calls", async () => {
    const getResponse = await GET(request("GET"));
    const postResponse = await POST(request("POST"));

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(200);
    expect(getResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(await getResponse.json()).toEqual({
      claimed: 2,
      deleted: 1,
      referenced: 1,
      retried: 0,
      discarded: 0
    });
    expect(mocks.drain).toHaveBeenNthCalledWith(1, { limit: 50 });
    expect(mocks.drain).toHaveBeenNthCalledWith(2, { limit: 50 });
  });

  it("returns a generic failure without exposing queue details", async () => {
    mocks.drain.mockRejectedValue(new Error("database path secret"));

    const response = await GET(request("GET"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Storage retention job failed"
    });
    expect(mocks.logError).toHaveBeenCalledWith(
      "Private storage retention job failed",
      { errorType: "Error" }
    );
  });
});
