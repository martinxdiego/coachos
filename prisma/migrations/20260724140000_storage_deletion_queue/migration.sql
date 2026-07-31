-- Durable transactional outbox for private Storage deletions. There is
-- deliberately no foreign key to Workspace: cleanup must survive deletion of
-- the owning workspace.
CREATE TABLE IF NOT EXISTS "storage_deletion_jobs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_path" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "lock_token" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_deletion_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "storage_deletion_jobs_bucket_check"
      CHECK ("bucket" IN ('player-photos', 'training-images')),
    CONSTRAINT "storage_deletion_jobs_workspace_prefix_check"
      CHECK (
        length("workspace_id") > 0
        AND left("object_path", length("workspace_id") + 1) =
          "workspace_id" || '/'
      ),
    CONSTRAINT "storage_deletion_jobs_canonical_path_check"
      CHECK (
        position('\' in "object_path") = 0
        AND position('%' in "object_path") = 0
        AND "object_path" !~ '(^|/)\.{1,2}(/|$)'
      )
);

CREATE UNIQUE INDEX IF NOT EXISTS "storage_deletion_jobs_bucket_object_path_key"
ON "storage_deletion_jobs"("bucket", "object_path");

CREATE INDEX IF NOT EXISTS "storage_deletion_jobs_due_idx"
ON "storage_deletion_jobs"("next_attempt_at", "locked_at");

CREATE INDEX IF NOT EXISTS "storage_deletion_jobs_workspace_bucket_idx"
ON "storage_deletion_jobs"("workspace_id", "bucket");

-- Some legacy databases were baselined before push subscriptions were added
-- to 0_init. Reconcile that safe schema drift here so deploy does not fail
-- merely because the baseline was resolved rather than executed.
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key"
ON "push_subscriptions"("endpoint");

-- Supports cascade cleanup and player-scoped subscription revocation without
-- a sequential scan.
CREATE INDEX IF NOT EXISTS "push_subscriptions_player_id_idx"
ON "push_subscriptions"("player_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'push_subscriptions_player_id_fkey'
      AND conrelid = 'public.push_subscriptions'::regclass
  ) THEN
    ALTER TABLE "push_subscriptions"
      ADD CONSTRAINT "push_subscriptions_player_id_fkey"
      FOREIGN KEY ("player_id") REFERENCES "Player"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
