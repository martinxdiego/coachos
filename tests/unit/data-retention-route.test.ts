import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findWorkspaces: vi.fn(),
  deletePlayerSessions: vi.fn(),
  deletePasswordTokens: vi.fn(),
  deleteVerificationTokens: vi.fn(),
  deleteAuditLogs: vi.fn(),
  transaction: vi.fn(),
  logError: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspace: { findMany: mocks.findWorkspaces },
    playerPortalSession: { deleteMany: mocks.deletePlayerSessions },
    passwordResetToken: { deleteMany: mocks.deletePasswordTokens },
    emailVerificationToken: { deleteMany: mocks.deleteVerificationTokens },
    auditLog: { deleteMany: mocks.deleteAuditLogs },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.logError }
}));

import { GET } from "@/app/api/data/retention/route";

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "retention-secret";
  mocks.findWorkspaces.mockResolvedValue([]);
  mocks.deletePlayerSessions.mockResolvedValue({ count: 2 });
  mocks.deletePasswordTokens.mockResolvedValue({ count: 3 });
  mocks.deleteVerificationTokens.mockResolvedValue({ count: 4 });
  mocks.deleteAuditLogs.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation((operations) => Promise.all(operations));
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

function request(secret?: string) {
  return new Request("https://coachos.test/api/data/retention", {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined
  });
}

describe("/api/data/retention", () => {
  it("fails closed without the cron secret", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.findWorkspaces).not.toHaveBeenCalled();
  });

  it("cleans global expired credentials and returns aggregate counts", async () => {
    const response = await GET(request("retention-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      workspaces: 0,
      healthChecks: 0,
      feedback: 0,
      coachMessages: 0,
      auditLogs: 1,
      playerSessions: 2,
      passwordResetTokens: 3,
      emailVerificationTokens: 4
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
