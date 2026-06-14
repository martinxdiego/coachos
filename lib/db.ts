import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { SUPABASE_CA_CERT } from "@/lib/supabase-ca";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables.");
  }

  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  const pool = new Pool({
    connectionString,
    ssl: resolveSslConfig(isLocal),
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

/**
 * Resolves the TLS configuration for the Postgres pool.
 *
 * Order of preference:
 *  1. Local connections: no TLS.
 *  2. `DATABASE_CA_CERT` set: full verification against the provided CA
 *     (override path — use this if Supabase rotates its root CA).
 *  3. `DATABASE_SSL_NO_VERIFY=true`: escape hatch, no verification.
 *  4. Otherwise: full verification against the bundled Supabase root CA.
 *     Supabase's self-signed root is NOT in the default Node CA bundle, so
 *     verifying against the system bundle alone fails with
 *     SELF_SIGNED_CERT_IN_CHAIN. Bundling the published root gives verified
 *     TLS to Supabase with no env var required.
 *
 * Disabling certificate verification (the old `rejectUnauthorized:false`
 * default) is now opt-in via `DATABASE_SSL_NO_VERIFY=true` and must only be used
 * as a temporary escape hatch — it exposes the connection to MITM attacks.
 */
function resolveSslConfig(isLocal: boolean) {
  if (isLocal) return false;

  const ca = process.env.DATABASE_CA_CERT;
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }

  if (process.env.DATABASE_SSL_NO_VERIFY === "true") {
    console.warn(
      "[db] TLS certificate verification is DISABLED (DATABASE_SSL_NO_VERIFY). " +
        "Unset it to verify against the bundled Supabase root CA."
    );
    return { rejectUnauthorized: false };
  }

  return { ca: SUPABASE_CA_CERT, rejectUnauthorized: true };
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
