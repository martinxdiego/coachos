import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { SUPABASE_CA_CERT } from "@/lib/supabase-ca";
import { normalizeDatabaseCaCert } from "@/lib/database-ca";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Boot-time sanity check on the connection target. Supabase's DIRECT host
 * (`db.<ref>.supabase.co`) is IPv6-only on the free tier, and Vercel functions
 * have no IPv6 egress — so a misconfigured DATABASE_URL pointing there fails
 * every DB route with an opaque "Can't reach database server", surfaced only as
 * the generic error boundary. Warn loudly and point at the fix (the IPv4
 * pooler) instead of leaving it to log forensics. Never logs the full string —
 * it carries the password.
 */
function warnIfUnreachableHost(connectionString: string): void {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return;
  }
  if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) {
    logger.warn(
      "DATABASE_URL points at the Supabase DIRECT host, which is IPv6-only " +
        "and unreachable from Vercel functions. Use the pooler host " +
        "(aws-<region>.pooler.supabase.com:6543) for the app runtime; the " +
        "direct host is only for `prisma migrate` (DIRECT_URL).",
      { host }
    );
  }
}

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables.");
  }

  warnIfUnreachableHost(connectionString);

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

  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (ca) {
    return {
      ca: normalizeDatabaseCaCert(ca),
      rejectUnauthorized: true
    };
  }

  if (process.env.DATABASE_SSL_NO_VERIFY === "true") {
    logger.warn(
      "TLS certificate verification is disabled (DATABASE_SSL_NO_VERIFY). " +
        "Unset it to verify against the bundled Supabase root CA."
    );
    return { rejectUnauthorized: false };
  }

  return { ca: SUPABASE_CA_CERT, rejectUnauthorized: true };
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
