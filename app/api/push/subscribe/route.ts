import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isTrustedPushEndpoint } from "@/lib/push-endpoint";
import { rateLimit } from "@/lib/rate-limit";
import type { Prisma } from "@prisma/client";
import { getPlayerPortalSession } from "@/lib/player-session";

const BASE64_URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;
// A full squad may enable notifications from the same clubhouse Wi-Fi. Keep
// the burst large enough for that legitimate flow while still bounding this
// public write endpoint independently of the broader middleware limit.
const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const TOKEN_RATE_LIMIT = 30;
const TOKEN_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const MAX_SUBSCRIPTIONS_PER_PLAYER = 5;

interface PushSubscriptionPayload {
  replaceExisting: boolean;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function isSafeKey(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= maxLength &&
    BASE64_URL_RE.test(value)
  );
}

function parsePayload(value: unknown): PushSubscriptionPayload | null {
  if (!value || typeof value !== "object") return null;

  const body = value as Record<string, unknown>;
  const subscription =
    body.subscription && typeof body.subscription === "object"
      ? (body.subscription as Record<string, unknown>)
      : null;
  const keys =
    subscription?.keys && typeof subscription.keys === "object"
      ? (subscription.keys as Record<string, unknown>)
      : null;
  const endpoint =
    typeof subscription?.endpoint === "string"
      ? subscription.endpoint.trim()
      : "";

  if (
    endpoint.length === 0 ||
    endpoint.length > 4096 ||
    !isSafeKey(keys?.p256dh, 512) ||
    !isSafeKey(keys?.auth, 256)
  ) {
    return null;
  }

  if (!isTrustedPushEndpoint(endpoint)) {
    return null;
  }

  return {
    replaceExisting: body.replaceExisting === true,
    subscription: {
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    },
  };
}

type PersistSubscriptionResult = "saved" | "conflict" | "device_limit";

class RetrySubscriptionTransaction extends Error {}

async function persistSubscriptionInTransaction(
  tx: Prisma.TransactionClient,
  playerId: string,
  subscription: PushSubscriptionPayload["subscription"],
  replaceExisting: boolean
): Promise<PersistSubscriptionResult> {
  const existing = await tx.pushSubscription.findUnique({
    where: { endpoint: subscription.endpoint },
    select: {
      playerId: true,
      p256dh: true,
      auth: true
    }
  });

  if (existing) {
    const belongsToPlayer = existing.playerId === playerId;
    const provesBrowserOwnership =
      existing.p256dh === subscription.keys.p256dh &&
      existing.auth === subscription.keys.auth;
    if (
      !belongsToPlayer &&
      (!replaceExisting || !provesBrowserOwnership)
    ) {
      return "conflict";
    }

    if (
      !belongsToPlayer &&
      (await tx.pushSubscription.count({ where: { playerId } })) >=
        MAX_SUBSCRIPTIONS_PER_PLAYER
    ) {
      return "device_limit";
    }

    const updated = await tx.pushSubscription.updateMany({
      where: {
        endpoint: subscription.endpoint,
        playerId: existing.playerId,
        p256dh: existing.p256dh,
        auth: existing.auth
      },
      data: {
        ...(belongsToPlayer ? {} : { playerId }),
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      }
    });

    if (updated.count === 0) {
      throw new RetrySubscriptionTransaction();
    }
    return "saved";
  }

  if (
    (await tx.pushSubscription.count({ where: { playerId } })) >=
    MAX_SUBSCRIPTIONS_PER_PLAYER
  ) {
    return "device_limit";
  }

  await tx.pushSubscription.create({
    data: {
      playerId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    }
  });
  return "saved";
}

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof RetrySubscriptionTransaction) return true;
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2002" || code === "P2034";
}

async function persistSubscription(
  playerId: string,
  subscription: PushSubscriptionPayload["subscription"],
  replaceExisting: boolean
): Promise<PersistSubscriptionResult> {
  // Serializable isolation makes the per-player device cap atomic even when
  // multiple new endpoints are registered concurrently. Unique/serialization
  // races are retried by replaying the complete transaction.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(
        (tx) =>
          persistSubscriptionInTransaction(
            tx,
            playerId,
            subscription,
            replaceExisting
          ),
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error)) throw error;
    }
  }

  if (lastError) throw lastError;
  return "conflict";
}

function subscriptionConflictResponse() {
  return NextResponse.json(
    {
      error: "Subscription conflict",
      code: "subscription_conflict"
    },
    {
      status: 409,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

function subscriptionDeviceLimitResponse() {
  return NextResponse.json(
    {
      error: "Subscription device limit reached",
      code: "device_limit"
    },
    {
      status: 409,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

function parseUnsubscribePayload(
  value: unknown
): { endpoint: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const endpoint =
    typeof body.endpoint === "string" ? body.endpoint.trim() : "";

  if (endpoint.length === 0 || endpoint.length > 4096) {
    return null;
  }

  if (!isTrustedPushEndpoint(endpoint)) {
    return null;
  }

  return { endpoint };
}

export async function POST(req: Request) {
  const portalSession = await getPlayerPortalSession();
  if (!portalSession) {
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  const limit = await rateLimit(
    `push-subscribe:${clientIp(req)}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS
  );
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": Math.max(
            1,
            Math.ceil((limit.reset - Date.now()) / 1000)
          ).toString(),
        },
      }
    );
  }

  const payload = parsePayload(await req.json().catch(() => null));
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid payload" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const { subscription } = payload;
  try {
    const tokenLimit = await rateLimit(
      `push-session:${portalSession.id}`,
      TOKEN_RATE_LIMIT,
      TOKEN_RATE_LIMIT_WINDOW_SECONDS
    );
    if (!tokenLimit.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": Math.max(
              1,
              Math.ceil((tokenLimit.reset - Date.now()) / 1000)
            ).toString()
          }
        }
      );
    }

    const persisted = await persistSubscription(
      portalSession.playerId,
      subscription,
      payload.replaceExisting
    );
    if (persisted === "conflict") {
      return subscriptionConflictResponse();
    }
    if (persisted === "device_limit") {
      return subscriptionDeviceLimitResponse();
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("Push subscription persistence failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error,
    });
    return NextResponse.json(
      { error: "Subscription could not be saved" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}

export async function DELETE(req: Request) {
  const portalSession = await getPlayerPortalSession();
  if (!portalSession) {
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  const limit = await rateLimit(
    `push-unsubscribe:${clientIp(req)}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS
  );
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": Math.max(
            1,
            Math.ceil((limit.reset - Date.now()) / 1000)
          ).toString()
        }
      }
    );
  }

  const payload = parseUnsubscribePayload(await req.json().catch(() => null));
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const tokenLimit = await rateLimit(
      `push-session:${portalSession.id}`,
      TOKEN_RATE_LIMIT,
      TOKEN_RATE_LIMIT_WINDOW_SECONDS
    );
    if (!tokenLimit.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": Math.max(
              1,
              Math.ceil((tokenLimit.reset - Date.now()) / 1000)
            ).toString()
          }
        }
      );
    }

    await db.pushSubscription.deleteMany({
      where: {
        endpoint: payload.endpoint,
        playerId: portalSession.playerId
      }
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("Push unsubscription persistence failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
    return NextResponse.json(
      { error: "Subscription could not be removed" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
