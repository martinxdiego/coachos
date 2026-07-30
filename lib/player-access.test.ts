import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deletePushSubscriptions: vi.fn(),
  deletePortalSessions: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    pushSubscription: { deleteMany: mocks.deletePushSubscriptions },
    playerPortalSession: { deleteMany: mocks.deletePortalSessions },
    player: { update: mocks.update },
    $transaction: mocks.transaction
  }
}));

import { rotatePlayerTokenAndRevokePush } from "./player-access";

describe("rotatePlayerTokenAndRevokePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deletePushSubscriptions.mockReturnValue({ operation: "delete-push" });
    mocks.deletePortalSessions.mockReturnValue({ operation: "delete-sessions" });
    mocks.update.mockReturnValue({ operation: "rotate-token" });
    mocks.transaction.mockResolvedValue([]);
  });

  it("atomically removes push subscriptions and rotates the bearer token", async () => {
    const playerId = "player-1";
    const token = await rotatePlayerTokenAndRevokePush(playerId);

    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(mocks.deletePushSubscriptions).toHaveBeenCalledWith({
      where: { playerId }
    });
    expect(mocks.deletePortalSessions).toHaveBeenCalledWith({
      where: { playerId }
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: playerId },
      data: { accessToken: token }
    });
    expect(mocks.transaction).toHaveBeenCalledWith([
      { operation: "delete-push" },
      { operation: "delete-sessions" },
      { operation: "rotate-token" }
    ]);
  });
});
