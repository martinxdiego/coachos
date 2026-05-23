import { redisClient, isRedisAvailable } from "./redis";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const inMemoryStore = new Map<string, { count: number; expiresAt: number }>();

if (typeof window === "undefined") {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of inMemoryStore.entries()) {
      if (value.expiresAt <= now) {
        inMemoryStore.delete(key);
      }
    }
  }, 60000);
  if (interval.unref) {
    interval.unref();
  }
}

export async function rateLimit(
  ip: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `rate_limit:${ip}`;

  if (isRedisAvailable && redisClient) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      const ttl = await redisClient.ttl(key);
      const remaining = Math.max(0, limit - count);
      const reset = Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000);

      return {
        success: count <= limit,
        limit,
        remaining,
        reset
      };
    } catch (err) {
      console.warn("Redis rateLimit failed, falling back to in-memory:", err);
    }
  }

  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || entry.expiresAt <= now) {
    const expiresAt = now + windowSeconds * 1000;
    inMemoryStore.set(key, { count: 1, expiresAt });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: expiresAt
    };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  return {
    success: entry.count <= limit,
    limit,
    remaining,
    reset: entry.expiresAt
  };
}
