import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsertJob: vi.fn(),
  findJobs: vi.fn(),
  updateJobs: vi.fn(),
  deleteJobs: vi.fn(),
  findPlayers: vi.fn(),
  findPhases: vi.fn(),
  transaction: vi.fn(),
  storageFrom: vi.fn(),
  storageRemove: vi.fn(),
  logError: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    storageDeletionJob: {
      findMany: mocks.findJobs,
      updateMany: mocks.updateJobs,
      deleteMany: mocks.deleteJobs
    },
    player: {
      findMany: mocks.findPlayers
    },
    trainingPhase: {
      findMany: mocks.findPhases
    },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    storage: {
      from: mocks.storageFrom
    }
  })
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.logError
  }
}));

import {
  drainStorageDeletionQueue,
  enqueueStorageDeletions,
  queueUploadedObjectDeletionBestEffort
} from "./storage-deletion-queue";
import {
  PLAYER_PHOTO_BUCKET,
  TRAINING_IMAGE_BUCKET
} from "./storage";

const now = new Date("2026-07-24T10:00:00.000Z");

function queuedJob(
  overrides: Partial<{
    id: string;
    workspaceId: string;
    bucket: string;
    objectPath: string;
    attempts: number;
  }> = {}
) {
  return {
    id: overrides.id ?? "job-1",
    workspaceId: overrides.workspaceId ?? "workspace-a",
    bucket: overrides.bucket ?? PLAYER_PHOTO_BUCKET,
    objectPath:
      overrides.objectPath ?? "workspace-a/player-photo.webp",
    generation: 0,
    attempts: overrides.attempts ?? 0,
    nextAttemptAt: now,
    lastAttemptAt: null,
    lockedAt: null,
    lockToken: null,
    lastError: null,
    createdAt: now,
    updatedAt: now
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findJobs.mockResolvedValue([]);
  mocks.updateJobs.mockResolvedValue({ count: 1 });
  mocks.deleteJobs.mockResolvedValue({ count: 1 });
  mocks.findPlayers.mockResolvedValue([]);
  mocks.findPhases.mockResolvedValue([]);
  mocks.storageRemove.mockResolvedValue({ error: null });
  mocks.storageFrom.mockReturnValue({
    remove: mocks.storageRemove
  });
  mocks.upsertJob.mockResolvedValue({ id: "job-1" });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      storageDeletionJob: {
        upsert: mocks.upsertJob
      }
    })
  );
});

describe("enqueueStorageDeletions", () => {
  it("writes only canonical objects inside the owning workspace", async () => {
    const tx = {
      storageDeletionJob: {
        upsert: mocks.upsertJob
      }
    };

    await expect(
      enqueueStorageDeletions(
        tx as never,
        "workspace-a",
        PLAYER_PHOTO_BUCKET,
        [
          "workspace-a/player.webp",
          "workspace-a/player.webp",
          "workspace-b/foreign.webp",
          "workspace-a/%2e%2e/foreign.webp"
        ]
      )
    ).resolves.toEqual(["job-1"]);

    expect(mocks.upsertJob).toHaveBeenCalledTimes(1);
    expect(mocks.upsertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          workspaceId: "workspace-a",
          bucket: PLAYER_PHOTO_BUCKET,
          objectPath: "workspace-a/player.webp"
        }),
        update: expect.objectContaining({
          generation: { increment: 1 },
          lockedAt: null,
          lockToken: null
        })
      })
    );
  });

  it("rejects unknown buckets and malformed workspace scopes", async () => {
    const tx = {
      storageDeletionJob: {
        upsert: mocks.upsertJob
      }
    };

    await expect(
      enqueueStorageDeletions(
        tx as never,
        "workspace-a/foreign",
        PLAYER_PHOTO_BUCKET,
        ["workspace-a/foreign/player.webp"]
      )
    ).rejects.toThrow("Invalid private storage deletion scope");
    await expect(
      enqueueStorageDeletions(
        tx as never,
        "workspace-a",
        "arbitrary-bucket",
        ["workspace-a/player.webp"]
      )
    ).rejects.toThrow("Invalid private storage deletion scope");
    expect(mocks.upsertJob).not.toHaveBeenCalled();
  });
});

describe("uploaded-object rollback", () => {
  it("does not risk deleting a possibly committed reference when DB state is unavailable", async () => {
    mocks.transaction.mockRejectedValue(
      new Error("ambiguous transaction result")
    );

    await queueUploadedObjectDeletionBestEffort(
      "workspace-a",
      PLAYER_PHOTO_BUCKET,
      "workspace-a/new-upload.webp"
    );

    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledWith(
      "Could not persist uploaded-object deletion job",
      { errorType: "Error" }
    );
  });
});

describe("drainStorageDeletionQueue", () => {
  it("removes an unreferenced object and completes its tombstone", async () => {
    mocks.findJobs.mockResolvedValue([queuedJob()]);

    const result = await drainStorageDeletionQueue({ limit: 10 });

    expect(mocks.storageFrom).toHaveBeenCalledWith(
      PLAYER_PHOTO_BUCKET
    );
    expect(mocks.storageRemove).toHaveBeenCalledWith([
      "workspace-a/player-photo.webp"
    ]);
    expect(mocks.deleteJobs).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        lockToken: expect.any(String),
        generation: 0
      }
    });
    expect(result).toEqual({
      claimed: 1,
      deleted: 1,
      referenced: 0,
      retried: 0,
      discarded: 0
    });
  });

  it("cancels a tombstone while another workspace-local reference exists", async () => {
    mocks.findJobs.mockResolvedValue([queuedJob()]);
    mocks.findPlayers.mockResolvedValue([
      { photoUrl: "workspace-a/player-photo.webp" }
    ]);

    const result = await drainStorageDeletionQueue();

    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.deleteJobs).toHaveBeenCalledTimes(1);
    expect(result.referenced).toBe(1);
    expect(result.deleted).toBe(0);
  });

  it("preserves a training image shared by another phase", async () => {
    mocks.findJobs.mockResolvedValue([
      queuedJob({
        bucket: TRAINING_IMAGE_BUCKET,
        objectPath: "workspace-a/training/shared.webp"
      })
    ]);
    mocks.findPhases.mockResolvedValue([
      { imageUrls: ["workspace-a/training/shared.webp"] }
    ]);

    const result = await drainStorageDeletionQueue();

    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.deleteJobs).toHaveBeenCalledTimes(1);
    expect(result.referenced).toBe(1);
  });

  it("discards a corrupt cross-workspace job without touching Storage", async () => {
    mocks.findJobs.mockResolvedValue([
      queuedJob({ objectPath: "workspace-b/foreign.webp" })
    ]);

    const result = await drainStorageDeletionQueue();

    expect(mocks.findPlayers).not.toHaveBeenCalled();
    expect(mocks.storageRemove).not.toHaveBeenCalled();
    expect(mocks.deleteJobs).toHaveBeenCalledTimes(1);
    expect(result.discarded).toBe(1);
  });

  it("keeps failed Storage removals queued with retry metadata", async () => {
    mocks.findJobs.mockResolvedValue([
      queuedJob({
        bucket: TRAINING_IMAGE_BUCKET,
        objectPath: "workspace-a/training/image.webp"
      })
    ]);
    mocks.storageRemove.mockResolvedValue({
      error: { name: "StorageError" }
    });

    const result = await drainStorageDeletionQueue();

    expect(mocks.deleteJobs).not.toHaveBeenCalled();
    expect(mocks.updateJobs).toHaveBeenCalledTimes(2);
    expect(mocks.updateJobs.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          attempts: { increment: 1 },
          lockedAt: null,
          lockToken: null,
          lastError: "storage-delete-failed"
        })
      })
    );
    expect(result.retried).toBe(1);
    expect(result.deleted).toBe(0);
  });
});
