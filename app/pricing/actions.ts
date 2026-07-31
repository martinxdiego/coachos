"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";

export async function startProCheckout() {
  const { user } = await requireUser();
  const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
  if (!priceId) {
    throw new Error("Der Pro-Tarif ist noch nicht für Zahlungen konfiguriert.");
  }

  const account = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionStatus: true
    }
  });
  if (!account) throw new Error("Konto nicht gefunden.");

  if (
    account.stripeCustomerId &&
    ["active", "trialing", "past_due"].includes(
      account.stripeSubscriptionStatus ?? ""
    )
  ) {
    redirect("/pricing?message=already-subscribed");
  }

  const stripe = getStripeClient();
  let customerId = account.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: account.email,
        metadata: { userId: user.id }
      },
      { idempotencyKey: `coachos-customer-${user.id}` }
    );
    customerId = customer.id;
    await db.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId }
    });
  }

  const siteUrl = getSiteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${siteUrl}/pricing?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    metadata: { userId: user.id },
    subscription_data: {
      metadata: { userId: user.id }
    }
  });
  if (!session.url) throw new Error("Stripe Checkout konnte nicht gestartet werden.");
  redirect(session.url);
}

export async function openBillingPortal() {
  const { user } = await requireUser();
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true }
  });
  if (!account?.stripeCustomerId) {
    throw new Error("Für dieses Konto existiert noch kein Abonnement.");
  }
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${getSiteUrl()}/pricing`
  });
  redirect(session.url);
}
