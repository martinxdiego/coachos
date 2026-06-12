-- S1.7: reduce Role enum to OWNER / COACH / ASSISTANT.
-- Runs inside Prisma's per-migration transaction, so any failure rolls back
-- cleanly with no partial state.

-- 1. Drop column defaults that reference the old enum.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" DROP DEFAULT;

-- 2. Swap the enum type.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('OWNER', 'COACH', 'ASSISTANT');

-- 3. Re-map existing rows onto the new set.
--    OWNER / ADMIN / HEAD_COACH -> OWNER (anyone who could manage the workspace)
--    TRAINER / COACH            -> COACH
--    everything else            -> ASSISTANT
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE "role"::text
      WHEN 'OWNER' THEN 'OWNER'
      WHEN 'ADMIN' THEN 'OWNER'
      WHEN 'HEAD_COACH' THEN 'OWNER'
      WHEN 'TRAINER' THEN 'COACH'
      WHEN 'COACH' THEN 'COACH'
      ELSE 'ASSISTANT'
    END
  )::"Role";

ALTER TABLE "WorkspaceMember"
  ALTER COLUMN "role" TYPE "Role"
  USING (
    CASE "role"::text
      WHEN 'OWNER' THEN 'OWNER'
      WHEN 'ADMIN' THEN 'OWNER'
      WHEN 'HEAD_COACH' THEN 'OWNER'
      WHEN 'TRAINER' THEN 'COACH'
      WHEN 'COACH' THEN 'COACH'
      ELSE 'ASSISTANT'
    END
  )::"Role";

-- 4. Restore defaults with the new values.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'COACH';
ALTER TABLE "WorkspaceMember" ALTER COLUMN "role" SET DEFAULT 'ASSISTANT';

-- 5. Drop the old enum.
DROP TYPE "Role_old";
