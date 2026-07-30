import type Redis from "ioredis";
import { logger } from "@/lib/logger";

let redisClient: Redis | null = null;
let connectionPromise: Promise<Redis | null> | null = null;
let fallbackWarningEmitted = false;

const INCREMENT_WITH_EXPIRY_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("TTL", KEYS[1])
if count == 1 or ttl < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

function warnAboutFallback(reason: "not_configured" | "unavailable") {
  if (fallbackWarningEmitted || process.env.NODE_ENV !== "production") return;
  fallbackWarningEmitted = true;
  logger.warn("Redis unavailable; using per-instance fallback", { reason });
}

/**
 * Redis is optional in development and tests. Initialising it here, rather
 * than at module scope, keeps `next build` free of network side effects and
 * avoids opening a connection for routes that never use Redis.
 */
export async function getRedisClient(): Promise<Redis | null> {
  const redisUrl = process.env.REDIS_URL;

  if (
    typeof window !== "undefined" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    return null;
  }
  if (!redisUrl) {
    warnAboutFallback("not_configured");
    return null;
  }

  if (redisClient?.status === "ready") {
    return redisClient;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const { default: RedisClient } = await import("ioredis");
      const client = new RedisClient(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
        lazyConnect: true
      });

      client.on("error", () => {
        // Callers deliberately fall back to DB/in-memory state. Do not log the
        // connection URL or emit noisy build-time warnings here.
      });

      await client.connect();
      redisClient = client;
      return client;
    } catch {
      redisClient = null;
      warnAboutFallback("unavailable");
      return null;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Increments a fixed-window counter and arms (or repairs) its expiry in one
 * Redis operation. This avoids permanent lockouts if a process dies between
 * separate INCR and EXPIRE commands.
 */
export async function incrementExpiringCounter(
  client: Redis,
  key: string,
  windowSeconds: number
): Promise<{ count: number; ttlSeconds: number }> {
  const result = await client.eval(
    INCREMENT_WITH_EXPIRY_SCRIPT,
    1,
    key,
    Math.max(1, Math.floor(windowSeconds)).toString()
  );
  if (
    !Array.isArray(result) ||
    result.length < 2 ||
    !Number.isFinite(Number(result[0])) ||
    !Number.isFinite(Number(result[1]))
  ) {
    throw new Error("Invalid Redis counter response.");
  }

  return {
    count: Number(result[0]),
    ttlSeconds: Math.max(1, Number(result[1]))
  };
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const val = await client.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch (error) {
    logger.warn("Redis cache operation failed", {
      operation: "get",
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    const stringified = JSON.stringify(value);
    await client.set(key, stringified, "EX", ttlSeconds);
  } catch (error) {
    logger.warn("Redis cache operation failed", {
      operation: "set",
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch (error) {
    logger.warn("Redis cache operation failed", {
      operation: "delete",
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
  }
}
