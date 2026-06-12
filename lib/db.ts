import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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
 *     (the secure production path — download Supabase's CA cert and set it).
 *  3. Otherwise: verified TLS via the system CA bundle.
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
        "Set DATABASE_CA_CERT for a secure connection."
    );
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
