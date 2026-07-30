ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "dataRetentionDays" INTEGER NOT NULL DEFAULT 730,
  ADD COLUMN IF NOT EXISTS "healthRetentionDays" INTEGER NOT NULL DEFAULT 365;

CREATE TABLE IF NOT EXISTS "player_portal_sessions" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "device_label" TEXT NOT NULL,
  "user_agent_hash" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_portal_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_portal_sessions_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "Player"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "player_portal_sessions_token_hash_key"
  ON "player_portal_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "player_portal_sessions_player_status_idx"
  ON "player_portal_sessions"("player_id", "revoked_at", "expires_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "actor_player_id" TEXT,
  "event" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "audit_logs_workspace_created_idx"
  ON "audit_logs"("workspace_id", "created_at");

ALTER TABLE "player_portal_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_portal_sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "player_portal_sessions" FROM anon, authenticated;
REVOKE ALL ON TABLE "audit_logs" FROM anon, authenticated;
