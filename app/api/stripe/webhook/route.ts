import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/billing";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!webhookSecret || !signature) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (subscriptionId) {
        const subscription =
          await getStripeClient().subscriptions.retrieve(subscriptionId);
        await syncStripeSubscription(
          subscription,
          session.metadata?.userId ?? session.client_reference_id
        );
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncStripeSubscription(event.data.object);
    }
  } catch (error) {
    logger.error("Stripe webhook synchronization failed", {
      eventType: event.type,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    });
    return NextResponse.json(
      { error: "Webhook synchronization failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
