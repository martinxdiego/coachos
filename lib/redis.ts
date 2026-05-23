let redisClient: any = null;
let isRedisAvailable = false;

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

if (typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge") {
  try {
    const Redis = require("ioredis");
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true
    });

    redisClient.on("error", (err: any) => {
      console.warn("Redis error, falling back to direct DB/in-memory:", err.message);
      isRedisAvailable = false;
    });

    redisClient.on("connect", () => {
      isRedisAvailable = true;
    });

    redisClient.connect().catch((err: any) => {
      console.warn("Could not connect to Redis:", err.message);
      isRedisAvailable = false;
    });
  } catch (err) {
    console.warn("Failed to initialize Redis client:", err);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisClient || !isRedisAvailable) return null;
  try {
    const val = await redisClient.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch (err) {
    console.warn(`Redis cacheGet failed for key "${key}":`, err);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
  if (!redisClient || !isRedisAvailable) return;
  try {
    const stringified = JSON.stringify(value);
    await redisClient.set(key, stringified, "EX", ttlSeconds);
  } catch (err) {
    console.warn(`Redis cacheSet failed for key "${key}":`, err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!redisClient || !isRedisAvailable) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.warn(`Redis cacheDel failed for key "${key}":`, err);
  }
}

export { redisClient, isRedisAvailable };
