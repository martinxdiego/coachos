import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, StorageDeletionJob } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  pathFromStorageReference,
  PLAYER_PHOTO_BUCKET,
  removeStorageReferences,
  storagePathsForReferences,
  TRAINING_IMAGE_BUCKET
} from "@/lib/storage";

const MAX_DRAIN_BATCH = 100;
const DEFAULT_DRAIN_BATCH = 25;
const STALE_LOCK_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;
const BASE_RETRY_DELAY_MS = 60 * 1000;

type PrivateStorageBucket =
  | typeof PLAYER_PHOTO_BUCKET
  | typeof TRAINING_IMAGE_BUCKET;

type QueueWriter = Pick<Prisma.TransactionClient, "storageDeletionJob">;

type ClaimedJob = StorageDeletionJob & {
  claimToken: string;
};

export interface StorageDeletionDrainOptions {
  ids?: readonly string[];
  limit?: number;
}

export interface StorageDeletionDrainResult {
  claimed: number;
  deleted: number;
  referenced: number;
  retried: number;
  discarded: number;
}

function emptyDrainResult(): StorageDeletionDrainResult {
  return {
    claimed: 0,
    deleted: 0,
    referenced: 0,
    retried: 0,
    discarded: 0
  };
}

function privateBucket(value: string): PrivateStorageBucket | null {
  if (
    value === PLAYER_PHOTO_BUCKET ||
    value === TRAINING_IMAGE_BUCKET
  ) {
    return value;
  }
  return null;
}

function workspacePrefix(workspaceId: string): string | null {
  return /^[A-Za-z0-9_-]+$/.test(workspaceId)
    ? `${workspaceId}/`
    : null;
}

/**
 * Adds canonical deletion tombstones through the caller's transaction client.
 * Callers must mutate the owning DB reference in that same transaction.
 */
export async function enqueueStorageDeletions(
  tx: QueueWriter,
  workspaceId: string,
  bucket: string,
  references: readonly (string | null | undefined)[]
): Promise<string[]> {
  const safeBucket = privateBucket(bucket);
  const expectedPrefix = workspacePrefix(workspaceId);
  if (!safeBucket || !expectedPrefix) {
    throw new Error("Invalid private storage deletion scope.");
  }

  const paths = storagePathsForReferences(
    safeBucket,
    references,
    expectedPrefix
  );
  const ids: string[] = [];

  for (const objectPath of paths) {
    const job = await tx.storageDeletionJob.upsert({
      where: {
        bucket_objectPath: {
          bucket: safeBucket,
          objectPath
        }
      },
      create: {
        workspaceId,
        bucket: safeBucket,
        objectPath
      },
      update: {
        workspaceId,
        generation: { increment: 1 },
        nextAttemptAt: new Date(),
        lockedAt: null,
        lockToken: null,
        lastError: null
      },
      select: { id: true }
    });
    ids.push(job.id);
  }

  return ids;
}

function normalizedLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_DRAIN_BATCH;
  return Math.max(
    1,
    Math.min(MAX_DRAIN_BATCH, Math.floor(limit ?? DEFAULT_DRAIN_BATCH))
  );
}

async function claimDueJobs(
  options: StorageDeletionDrainOptions
): Promise<ClaimedJob[]> {
  const ids = options.ids
    ? Array.from(new Set(options.ids.filter(Boolean))).slice(
        0,
        MAX_DRAIN_BATCH
      )
    : undefined;
  if (ids && ids.length === 0) return [];

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  const availability: Prisma.StorageDeletionJobWhereInput = {
    nextAttemptAt: { lte: now },
    OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }]
  };
  const candidates = await db.storageDeletionJob.findMany({
    where: {
      ...availability,
      ...(ids ? { id: { in: ids } } : {})
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: normalizedLimit(options.limit),
  });
  const claimed: ClaimedJob[] = [];

  for (const candidate of candidates) {
    const claimToken = randomUUID();
    const claim = await db.storageDeletionJob.updateMany({
      where: {
        id: candidate.id,
        ...availability
      },
      data: {
        lockedAt: now,
        lockToken: claimToken,
        lastAttemptAt: now
      }
    });
    if (claim.count === 1) {
      claimed.push({ ...candidate, claimToken });
    }
  }

  return claimed;
}

async function completeJob(job: ClaimedJob): Promise<boolean> {
  const result = await db.storageDeletionJob.deleteMany({
    where: {
      id: job.id,
      lockToken: job.claimToken,
      generation: job.generation
    }
  });
  return result.count === 1;
}

function retryDelay(attempts: number): number {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** Math.min(Math.max(attempts, 0), 10)
  );
}

async function retryJob(job: ClaimedJob, reason: string): Promise<boolean> {
  const result = await db.storageDeletionJob.updateMany({
    where: {
      id: job.id,
      lockToken: job.claimToken,
      generation: job.generation
    },
    data: {
      attempts: { increment: 1 },
      nextAttemptAt: new Date(Date.now() + retryDelay(job.attempts)),
      lockedAt: null,
      lockToken: null,
      lastError: reason
    }
  });
  return result.count === 1;
}

async function referencedPaths(
  workspaceId: string,
  bucket: PrivateStorageBucket,
  expectedPrefix: string
): Promise<Set<string>> {
  if (bucket === PLAYER_PHOTO_BUCKET) {
    const players = await db.player.findMany({
      where: { workspaceId },
      select: { photoUrl: true }
    });
    return new Set(
      storagePathsForReferences(
        bucket,
        players.map((player) => player.photoUrl),
        expectedPrefix
      )
    );
  }

  const phases = await db.trainingPhase.findMany({
    where: { training: { workspaceId } },
    select: { imageUrls: true }
  });
  return new Set(
    storagePathsForReferences(
      bucket,
      phases.flatMap((phase) => phase.imageUrls ?? []),
      expectedPrefix
    )
  );
}

/**
 * Claims due tombstones, re-checks live DB references, and removes only
 * unreferenced objects. Failed removals stay queued with exponential backoff.
 */
export async function drainStorageDeletionQueue(
  options: StorageDeletionDrainOptions = {}
): Promise<StorageDeletionDrainResult> {
  const result = emptyDrainResult();
  const claimed = await claimDueJobs(options);
  result.claimed = claimed.length;
  if (claimed.length === 0) return result;

  const groups = new Map<
    string,
    {
      workspaceId: string;
      bucket: PrivateStorageBucket;
      expectedPrefix: string;
      jobs: ClaimedJob[];
    }
  >();

  for (const job of claimed) {
    const bucket = privateBucket(job.bucket);
    const expectedPrefix = workspacePrefix(job.workspaceId);
    const canonicalPath =
      bucket && expectedPrefix
        ? pathFromStorageReference(
            job.objectPath,
            bucket,
            expectedPrefix
          )
        : null;

    if (!bucket || !expectedPrefix || canonicalPath !== job.objectPath) {
      if (await completeJob(job)) result.discarded += 1;
      logger.error("Discarded invalid private storage deletion job", {
        errorType: "InvalidStorageDeletionScope"
      });
      continue;
    }

    const key = `${job.workspaceId}\u0000${bucket}`;
    const group = groups.get(key);
    if (group) {
      group.jobs.push(job);
    } else {
      groups.set(key, {
        workspaceId: job.workspaceId,
        bucket,
        expectedPrefix,
        jobs: [job]
      });
    }
  }

  for (const group of groups.values()) {
    let retainedPaths: Set<string>;
    try {
      retainedPaths = await referencedPaths(
        group.workspaceId,
        group.bucket,
        group.expectedPrefix
      );
    } catch (error) {
      logger.error("Private storage reference reconciliation failed", {
        errorType:
          error instanceof Error ? error.constructor.name : typeof error
      });
      for (const job of group.jobs) {
        if (await retryJob(job, "reference-check-failed")) {
          result.retried += 1;
        }
      }
      continue;
    }

    const deletable: ClaimedJob[] = [];
    for (const job of group.jobs) {
      if (retainedPaths.has(job.objectPath)) {
        if (await completeJob(job)) result.referenced += 1;
      } else {
        deletable.push(job);
      }
    }
    if (deletable.length === 0) continue;

    const removed = await removeStorageReferences(
      group.bucket,
      deletable.map((job) => job.objectPath),
      group.expectedPrefix
    );
    if (removed) {
      for (const job of deletable) {
        if (await completeJob(job)) result.deleted += 1;
      }
    } else {
      for (const job of deletable) {
        if (await retryJob(job, "storage-delete-failed")) {
          result.retried += 1;
        }
      }
    }
  }

  return result;
}

export async function drainStorageDeletionQueueBestEffort(
  options: StorageDeletionDrainOptions = {}
): Promise<void> {
  try {
    await drainStorageDeletionQueue(options);
  } catch (error) {
    logger.error("Private storage deletion drain failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
  }
}

/**
 * Queues cleanup for a newly uploaded object that never became a DB
 * reference. This is separate from reference-removal flows, which must call
 * enqueueStorageDeletions inside their own mutation transaction.
 */
export async function queueUploadedObjectDeletionBestEffort(
  workspaceId: string,
  bucket: string,
  reference: string
): Promise<void> {
  const expectedPrefix = workspacePrefix(workspaceId);
  if (!privateBucket(bucket) || !expectedPrefix) return;

  try {
    const ids = await db.$transaction((tx) =>
      enqueueStorageDeletions(tx, workspaceId, bucket, [reference])
    );
    await drainStorageDeletionQueueBestEffort({
      ids,
      limit: ids.length
    });
  } catch (error) {
    logger.error("Could not persist uploaded-object deletion job", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
    // A transaction can fail ambiguously after the database committed. Never
    // delete the object without a successful DB reference reconciliation:
    // preserving a possible orphan is safer than breaking a live reference.
  }
}
