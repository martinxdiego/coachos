import { redisClient, isRedisAvailable } from "./redis";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;

interface ThrottleState {
  locked: boolean;
  retryAfterSeconds: number;
}

const inMemory = new Map<string, { count: number; expiresAt: number }>();

if (typeof window === "undefined") {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of inMemory.entries()) {
      if (value.expiresAt <= now) inMemory.delete(key);
    }
  }, 60_000);
  if (interval.unref) interval.unref();
}

function keyFor(identifier: string): string {
  return `login_fail:${identifier.toLowerCase()}`;
}

/**
 * Returns whether the identifier (e.g. an email) is currently locked out after
 * too many failed login attempts, and how long until it may try again.
 */
export async function getLoginThrottle(identifier: string): Promise<ThrottleState> {
  const key = keyFor(identifier);

  if (isRedisAvailable && redisClient) {
    try {
      const count = Number((await redisClient.get(key)) ?? 0);
      if (count >= MAX_ATTEMPTS) {
        const ttl = await redisClient.ttl(key);
        return { locked: true, retryAfterSeconds: ttl > 0 ? ttl : LOCK_SECONDS };
      }
      return { locked: false, retryAfterSeconds: 0 };
    } catch {
      // fall through to in-memory
    }
  }

  const entry = inMemory.get(key);
  if (entry && entry.expiresAt > Date.now() && entry.count >= MAX_ATTEMPTS) {
    return {
      locked: true,
      retryAfterSeconds: Math.ceil((entry.expiresAt - Date.now()) / 1000),
    };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

/** Records a failed login attempt and (re)arms the lockout window. */
export async function recordFailedLogin(identifier: string): Promise<void> {
  const key = keyFor(identifier);

  if (isRedisAvailable && redisClient) {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) await redisClient.expire(key, LOCK_SECONDS);
      return;
    } catch {
      // fall through to in-memory
    }
  }

  const now = Date.now();
  const entry = inMemory.get(key);
  if (!entry || entry.expiresAt <= now) {
    inMemory.set(key, { count: 1, expiresAt: now + LOCK_SECONDS * 1000 });
  } else {
    entry.count++;
  }
}

/** Clears the failure counter after a successful login. */
export async function clearLoginAttempts(identifier: string): Promise<void> {
  const key = keyFor(identifier);
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch {
      // fall through
    }
  }
  inMemory.delete(key);
}
