import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });
dotenv.config();

// The Prisma CLI (migrate/generate) needs a DIRECT database connection.
// Supabase's pooled URL (PgBouncer transaction mode, port 6543) does not
// support the session features migrations require and will hang. Prefer
// DIRECT_URL (the direct connection, port 5432) when set; fall back to
// DATABASE_URL for local/dev where the two are the same. The app runtime
// does NOT use this — it connects via the pg adapter on DATABASE_URL.
const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/coachos";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrationUrl,
  },
});
