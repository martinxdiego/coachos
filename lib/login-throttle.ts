import {
  getRedisClient,
  incrementExpiringCounter
} from "./redis";
import { opaqueKey } from "./opaque-key";

const MAX_PAIR_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 25;
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

async function keysFor(identifier: string, clientIp: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const normalizedIp = clientIp.trim().toLowerCase() || "unknown";
  return Promise.all([
    opaqueKey(
      "login_fail_pair",
      `${normalizedIdentifier}\u0000${normalizedIp}`
    ),
    opaqueKey("login_fail_ip", normalizedIp)
  ]);
}

/**
 * Limits a source IP globally and an account/IP pair narrowly. A remote
 * attacker can therefore throttle their own source without locking a known
 * account for the legitimate user on another network.
 */
export async function getLoginThrottle(
  identifier: string,
  clientIp: string
): Promise<ThrottleState> {
  const [pairKey, ipKey] = await keysFor(identifier, clientIp);
  const redisClient = await getRedisClient();

  if (redisClient) {
    try {
      const [pairCount, ipCount] = await Promise.all([
        redisClient.get(pairKey),
        redisClient.get(ipKey)
      ]);
      const pairLocked = Number(pairCount ?? 0) >= MAX_PAIR_ATTEMPTS;
      const ipLocked = Number(ipCount ?? 0) >= MAX_IP_ATTEMPTS;
      if (pairLocked || ipLocked) {
        const ttls = await Promise.all([
          pairLocked ? redisClient.ttl(pairKey) : Promise.resolve(0),
          ipLocked ? redisClient.ttl(ipKey) : Promise.resolve(0)
        ]);
        const activeTtls = ttls.filter((ttl) => ttl > 0);
        return {
          locked: true,
          retryAfterSeconds:
            activeTtls.length > 0
              ? Math.max(...activeTtls)
              : LOCK_SECONDS
        };
      }
      return { locked: false, retryAfterSeconds: 0 };
    } catch {
      // fall through to in-memory
    }
  }

  const now = Date.now();
  const pairEntry = inMemory.get(pairKey);
  const ipEntry = inMemory.get(ipKey);
  const pairLocked =
    Boolean(pairEntry && pairEntry.expiresAt > now) &&
    (pairEntry?.count ?? 0) >= MAX_PAIR_ATTEMPTS;
  const ipLocked =
    Boolean(ipEntry && ipEntry.expiresAt > now) &&
    (ipEntry?.count ?? 0) >= MAX_IP_ATTEMPTS;
  if (pairLocked || ipLocked) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(
        1,
        ...[pairEntry, ipEntry]
          .filter(
            (entry): entry is { count: number; expiresAt: number } =>
              Boolean(entry && entry.expiresAt > now)
          )
          .map((entry) => Math.ceil((entry.expiresAt - now) / 1000))
      )
    };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

/** Records a failed login attempt and (re)arms the lockout window. */
export async function recordFailedLogin(
  identifier: string,
  clientIp: string
): Promise<void> {
  const keys = await keysFor(identifier, clientIp);
  const redisClient = await getRedisClient();

  if (redisClient) {
    try {
      await Promise.all(
        keys.map((key) =>
          incrementExpiringCounter(redisClient, key, LOCK_SECONDS)
        )
      );
      return;
    } catch {
      // fall through to in-memory
    }
  }

  const now = Date.now();
  for (const key of keys) {
    const entry = inMemory.get(key);
    if (!entry || entry.expiresAt <= now) {
      inMemory.set(key, { count: 1, expiresAt: now + LOCK_SECONDS * 1000 });
    } else {
      entry.count++;
    }
  }
}

/** Clears only the successful account/source pair, not the global IP budget. */
export async function clearLoginAttempts(
  identifier: string,
  clientIp: string
): Promise<void> {
  const [pairKey] = await keysFor(identifier, clientIp);
  const redisClient = await getRedisClient();
  if (redisClient) {
    try {
      await redisClient.del(pairKey);
      return;
    } catch {
      // fall through
    }
  }
  inMemory.delete(pairKey);
}
