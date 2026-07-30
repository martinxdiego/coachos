-- Bearer links must resolve to exactly one player. UUID collisions are
-- improbable, but the authorization boundary belongs in the database.
CREATE UNIQUE INDEX IF NOT EXISTS "Player_accessToken_key"
ON "Player"("accessToken");
