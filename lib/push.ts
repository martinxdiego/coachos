import webpush from "web-push";
import { db } from "./db";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys not configured — skipping notification.");
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

/**
 * Sends a single web-push notification. Returns true on success. Dead
 * subscriptions (410/404) are removed from the database. Designed to be called
 * directly from a request/cron handler — there is no background worker.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionInput,
  payload: PushPayload
): Promise<boolean> {
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return false;
  }
  if (!ensureVapid()) return false;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: any) {
    const status = err?.statusCode;
    if (status === 410 || status === 404) {
      // Subscription is gone — clean it up so we stop trying.
      await db.pushSubscription
        .deleteMany({ where: { endpoint: subscription.endpoint } })
        .catch(() => {});
    } else {
      console.warn("[push] send failed:", err?.message);
    }
    return false;
  }
}
