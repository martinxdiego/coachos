import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  loggerError: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: storageMocks.createSignedUrl,
        remove: storageMocks.remove
      })
    }
  })
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: storageMocks.loggerError }
}));

import {
  pathFromStorageReference,
  removeStorageReferences,
  storagePathsForReferences
} from "./storage";

describe("workspace-bound storage references", () => {
  beforeEach(() => {
    storageMocks.createSignedUrl.mockReset();
    storageMocks.remove.mockReset();
    storageMocks.loggerError.mockReset();
  });

  it("accepts relative and Supabase URL references within the exact prefix", () => {
    expect(
      pathFromStorageReference(
        "workspace-a/player.webp",
        "player-photos",
        "workspace-a/"
      )
    ).toBe("workspace-a/player.webp");
    expect(
      pathFromStorageReference(
        "https://example.supabase.co/storage/v1/object/sign/player-photos/workspace-a/player.webp?token=secret",
        "player-photos",
        "workspace-a/"
      )
    ).toBe("workspace-a/player.webp");
  });

  it("rejects foreign, lookalike, traversal, and nested-marker references", () => {
    const references = [
      "workspace-b/player.webp",
      "workspace-a-evil/player.webp",
      "workspace-a/%2e%2e/workspace-b/player.webp",
      "workspace-a/%252e%252e/workspace-b/player.webp",
      "https://example.com/prefix/storage/v1/object/public/player-photos/workspace-a/player.webp"
    ];

    for (const reference of references) {
      expect(
        pathFromStorageReference(
          reference,
          "player-photos",
          "workspace-a/"
        )
      ).toBeNull();
    }
  });

  it("deduplicates only references inside the expected workspace", () => {
    expect(
      storagePathsForReferences(
        "player-photos",
        [
          "workspace-a/player.webp",
          "workspace-a/player.webp",
          "workspace-b/foreign.webp"
        ],
        "workspace-a/"
      )
    ).toEqual(["workspace-a/player.webp"]);
  });

  it("never forwards foreign paths to the service-role delete", async () => {
    storageMocks.remove.mockResolvedValue({ error: null });

    await expect(
      removeStorageReferences(
        "player-photos",
        [
          "workspace-a/player.webp",
          "workspace-b/foreign.webp",
          "workspace-a-evil/lookalike.webp"
        ],
        "workspace-a/"
      )
    ).resolves.toBe(true);

    expect(storageMocks.remove).toHaveBeenCalledWith([
      "workspace-a/player.webp"
    ]);
  });
});
