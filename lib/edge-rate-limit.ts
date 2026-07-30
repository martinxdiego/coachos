import { opaqueKey } from "./opaque-key";

export interface EdgeRateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface Entry {
  count: number;
  expiresAt: number;
}

// Middleware runs in isolated Edge instances. This bounded store is an
// inexpensive first line of defence; security-sensitive mutations also use
// the shared Redis-backed limiter in their Node.js route/action.
const entries = new Map<string, Entry>();
const MAX_ENTRIES = 5_000;
let operationCount = 0;

function pruneExpiredEntries(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }

  while (entries.size >= MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value as string | undefined;
    if (!oldestKey) break;
    entries.delete(oldestKey);
  }
}

export async function edgeRateLimit(
  identifier: string,
  limit = 60,
  windowSeconds = 60
): Promise<EdgeRateLimitResult> {
  const now = Date.now();
  operationCount += 1;

  if (operationCount % 100 === 0 || entries.size >= MAX_ENTRIES) {
    pruneExpiredEntries(now);
  }

  const key = await opaqueKey("edge_rate_limit", identifier);
  const current = entries.get(key);

  if (!current || current.expiresAt <= now) {
    const reset = now + windowSeconds * 1_000;
    entries.set(key, { count: 1, expiresAt: reset });
    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - 1),
      reset,
    };
  }

  current.count += 1;
  return {
    success: current.count <= limit,
    limit,
    remaining: Math.max(0, limit - current.count),
    reset: current.expiresAt,
  };
}
