import { NextResponse } from "next/server";
import { todayIsoDate } from "@/lib/utils";
import { db } from "@/lib/db";
import { addJob } from "@/lib/queue";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayIsoDate();

  try {
    const [subs, checkins] = await Promise.all([
      db.pushSubscription.findMany({
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              name: true,
              accessToken: true
            }
          }
        }
      }),
      db.healthCheck.findMany({
        where: {
          date: new Date(`${today}T00:00:00.000Z`)
        },
        select: {
          playerId: true
        }
      })
    ]);

    const checkedInIds = new Set<string>(checkins.map((c) => c.playerId));
    const pending = subs.filter((sub) => !checkedInIds.has(sub.playerId));

    if (pending.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let queuedCount = 0;
    await Promise.all(
      pending.map(async (sub) => {
        const player = sub.player;
        if (!player) return;

        await addJob("push-notifications", `daily-wellness-${player.id}-${today}`, {
          subscription: {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth
          },
          payload: {
            title: `Hey ${player.firstName ?? player.name}! 👋`,
            body: "Zeit für deinen Wellness-Check. Wie fühlst du dich heute?",
            url: `/spieler/${player.accessToken}`
          }
        });
        queuedCount++;
      })
    );

    return NextResponse.json({ queued: queuedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
