-- S3.3: consolidate the two-generation PlayerStatus enum into one set.
-- Only Player.status uses this enum. Transaction-safe (rolls back on error).

ALTER TABLE "Player" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "PlayerStatus" RENAME TO "PlayerStatus_old";
CREATE TYPE "PlayerStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'INJURED', 'ABSENT');

ALTER TABLE "Player"
  ALTER COLUMN "status" TYPE "PlayerStatus"
  USING (
    CASE "status"::text
      WHEN 'FIT' THEN 'AVAILABLE'
      WHEN 'available' THEN 'AVAILABLE'
      WHEN 'REHAB' THEN 'LIMITED'
      WHEN 'limited' THEN 'LIMITED'
      WHEN 'INJURED' THEN 'INJURED'
      WHEN 'injured' THEN 'INJURED'
      WHEN 'absent' THEN 'ABSENT'
      ELSE 'AVAILABLE'
    END::"PlayerStatus"
  );

ALTER TABLE "Player" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';

DROP TYPE "PlayerStatus_old";
