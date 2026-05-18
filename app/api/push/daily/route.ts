import webpush from "web-push";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIsoDate } from "@/lib/utils";

type PushSub = {
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const db = createAdminClient() as any;
  const today = todayIsoDate();

  const [subsResult, checkinsResult] = await Promise.all([
    db.from("push_subscriptions").select("player_id, endpoint, p256dh, auth"),
    db.from("health_checkins").select("player_id").eq("checkin_date", today),
  ]);

  const checkedInIds = new Set<string>(
    (checkinsResult.data ?? []).map((c: { player_id: string }) => c.player_id)
  );
  const pending: PushSub[] = (subsResult.data ?? []).filter(
    (s: PushSub) => !checkedInIds.has(s.player_id)
  );

  if (pending.length === 0) return NextResponse.json({ sent: 0 });

  const playerIds = [...new Set(pending.map((s) => s.player_id))];
  const { data: players } = await db
    .from("players")
    .select("id, first_name, name, access_token")
    .in("id", playerIds);

  const playerMap = new Map(
    (players ?? []).map((p: { id: string; first_name: string | null; name: string; access_token: string }) => [p.id, p])
  );
  const dead: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    pending.map(async (sub) => {
      const player = playerMap.get(sub.player_id) as
        | { id: string; first_name: string | null; name: string; access_token: string }
        | undefined;
      if (!player) return;
      const payload = JSON.stringify({
        title: `Hey ${player.first_name ?? player.name}! 👋`,
        body: "Zeit für deinen Wellness-Check. Wie fühlst du dich heute?",
        url: `/spieler/${player.access_token}`,
      });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) dead.push(sub.endpoint);
      }
    })
  );

  if (dead.length) {
    await db.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({ sent, expired: dead.length });
}
