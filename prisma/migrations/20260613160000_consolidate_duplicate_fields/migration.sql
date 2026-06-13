-- S3.2: drop duplicate columns, keeping one canonical field each.
-- Backfill the canonical column from the legacy one before dropping, so no
-- data is lost. Transaction-safe (rolls back on any error).

-- Player.number -> jerseyNumber
UPDATE "Player" SET "jerseyNumber" = "number"
  WHERE "jerseyNumber" IS NULL AND "number" IS NOT NULL;
ALTER TABLE "Player" DROP COLUMN "number";

-- Player.preferredFoot -> strongFoot
UPDATE "Player" SET "strongFoot" = "preferredFoot"
  WHERE "strongFoot" IS NULL AND "preferredFoot" IS NOT NULL;
ALTER TABLE "Player" DROP COLUMN "preferredFoot";

-- Training.duration -> durationMinutes (canonical, NOT NULL, app-maintained).
-- Recover real durations for legacy rows still sitting at the default 90.
UPDATE "Training" SET "durationMinutes" = "duration"
  WHERE "durationMinutes" = 90 AND "duration" IS NOT NULL AND "duration" <> 90;
ALTER TABLE "Training" DROP COLUMN "duration";

-- Match.home (bool) -> homeAway (string)
UPDATE "Match" SET "homeAway" = CASE WHEN "home" THEN 'home' ELSE 'away' END
  WHERE "homeAway" IS NULL;
ALTER TABLE "Match" DROP COLUMN "home";

-- Rating.behaviour -> behavior
UPDATE "Rating" SET "behavior" = "behaviour"
  WHERE "behavior" IS NULL AND "behaviour" IS NOT NULL;
ALTER TABLE "Rating" DROP COLUMN "behaviour";
