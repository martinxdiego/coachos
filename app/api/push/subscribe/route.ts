import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { subscription, playerId } = body ?? {};

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth || !playerId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        playerId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        playerId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
