import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Stripe ist noch nicht konfiguriert.");
  }
  if (!client) {
    client = new Stripe(secretKey, {
      apiVersion: "2026-07-29.dahlia",
      typescript: true,
      appInfo: {
        name: "CoachOS",
        version: "0.1.0"
      }
    });
  }
  return client;
}
