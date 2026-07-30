import "server-only";

import type Stripe from "stripe";
import { db } from "@/lib/db";

export const FREE_PLAYER_LIMIT = 30;
export const FREE_OWNED_WORKSPACE_LIMIT = 1;

export function billingEnforced() {
  return process.env.BILLING_ENFORCE === "true";
}

export function planForSubscriptionStatus(status: string) {
  return status === "active" || status === "trialing" ? "PRO" : "FREE";
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const timestamps = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));
  return timestamps.length > 0
    ? new Date(Math.max(...timestamps) * 1000)
    : null;
}

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const userId = subscription.metadata.userId || fallbackUserId || null;
  const data = {
    billingPlan: planForSubscriptionStatus(subscription.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
    subscriptionCurrentPeriodEnd: subscriptionPeriodEnd(subscription)
  } as const;

  if (userId) {
    await db.user.updateMany({
      where: { id: userId },
      data
    });
    return;
  }

  await db.user.updateMany({
    where: {
      OR: [
        { stripeSubscriptionId: subscription.id },
        { stripeCustomerId: customerId }
      ]
    },
    data
  });
}

export async function assertCanCreateWorkspace(userId: string) {
  if (!billingEnforced()) return;
  const [user, ownedWorkspaces] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { billingPlan: true }
    }),
    db.workspaceMember.count({
      where: { userId, role: "OWNER" }
    })
  ]);
  if (
    user?.billingPlan !== "PRO" &&
    ownedWorkspaces >= FREE_OWNED_WORKSPACE_LIMIT
  ) {
    throw new Error(
      "Im Free-Tarif ist ein eigener Workspace enthalten. Für weitere Teams ist Pro erforderlich."
    );
  }
}

async function workspaceOwnerIsPro(workspaceId: string) {
  const owner = await db.workspaceMember.findFirst({
    where: { workspaceId, role: "OWNER" },
    select: { user: { select: { billingPlan: true } } }
  });
  return owner?.user.billingPlan === "PRO";
}

export async function assertCanAddPlayers(workspaceId: string, amount: number) {
  if (!billingEnforced() || (await workspaceOwnerIsPro(workspaceId))) return;
  const current = await db.player.count({ where: { workspaceId } });
  if (current + amount > FREE_PLAYER_LIMIT) {
    throw new Error(
      `Der Free-Tarif umfasst bis zu ${FREE_PLAYER_LIMIT} Spieler. Für einen größeren Kader ist Pro erforderlich.`
    );
  }
}

export async function assertProFeature(workspaceId: string, feature: string) {
  if (!billingEnforced() || (await workspaceOwnerIsPro(workspaceId))) return;
  throw new Error(`${feature} ist im Pro-Tarif enthalten.`);
}
