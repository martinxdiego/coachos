DO $$ BEGIN
  CREATE TYPE "AvailabilityEventType" AS ENUM ('TRAINING', 'MATCH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AvailabilityResponseStatus" AS ENUM ('YES', 'MAYBE', 'NO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "availability_responses" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "event_type" "AvailabilityEventType" NOT NULL,
  "event_id" TEXT NOT NULL,
  "status" "AvailabilityResponseStatus" NOT NULL,
  "comment" TEXT,
  "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "availability_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_responses_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "availability_responses_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "Player"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "availability_responses_player_event_key"
  ON "availability_responses"("player_id", "event_type", "event_id");
CREATE INDEX IF NOT EXISTS "availability_responses_workspace_event_idx"
  ON "availability_responses"("workspace_id", "event_type", "event_id");

ALTER TABLE "availability_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availability_responses" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "availability_responses" FROM anon, authenticated;
