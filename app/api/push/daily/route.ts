import { NextResponse } from "next/server";
import { todayIsoDate } from "@/lib/utils";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPushNotification } from "@/lib/push";

const QUERY_BATCH_SIZE = 100;
const SEND_CONCURRENCY = 10;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return Boolean(secret && authHeader === `Bearer ${secret}`);
}

async function runDailyPush(req: Request) {
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);

  const today = todayIsoDate();

  try {
    let cursor: string | undefined;
    let sent = 0;
    let attempted = 0;

    while (true) {
      const subscriptions = await db.pushSubscription.findMany({
        take: QUERY_BATCH_SIZE,
        orderBy: { id: "asc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          player: {
            select: {
              accessToken: true
            }
          }
        }
      });

      if (subscriptions.length === 0) break;

      const playerIds = Array.from(
        new Set(subscriptions.map((subscription) => subscription.playerId))
      );
      const checkins = await db.healthCheck.findMany({
        where: {
          date: new Date(`${today}T00:00:00.000Z`),
          playerId: { in: playerIds }
        },
        select: {
          playerId: true
        }
      });

      const checkedInIds = new Set<string>(
        checkins.map((checkin) => checkin.playerId)
      );
      const pending = subscriptions.filter(
        (subscription) => !checkedInIds.has(subscription.playerId)
      );
      attempted += pending.length;

      for (let index = 0; index < pending.length; index += SEND_CONCURRENCY) {
        const group = pending.slice(index, index + SEND_CONCURRENCY);
        const results = await Promise.all(
          group.map(async (subscription) => {
            const player = subscription.player;
            if (!player) return false;

            return sendPushNotification(
              {
                endpoint: subscription.endpoint,
                p256dh: subscription.p256dh,
                auth: subscription.auth
              },
              {
                // Lock-screen notifications can be visible on shared devices.
                // Keep the preview useful without exposing a player's name or
                // health wording; the bearer link opens the detail.
                title: "CoachOS",
                body: "Zeit für deinen täglichen Check-in.",
                url: "/player"
              }
            );
          })
        );
        sent += results.filter(Boolean).length;
      }

      cursor = subscriptions.at(-1)?.id;
      if (subscriptions.length < QUERY_BATCH_SIZE || !cursor) break;
    }

    return json({ sent, attempted });
  } catch (error) {
    logger.error("Daily push job failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error,
    });
    return json({ error: "Push job failed" }, 500);
  }
}

// Vercel Cron invokes configured paths with GET. Keep POST as an authenticated
// compatibility entry point for existing manual runbooks.
export async function GET(req: Request) {
  return runDailyPush(req);
}

export async function POST(req: Request) {
  return runDailyPush(req);
}
