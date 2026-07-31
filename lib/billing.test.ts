import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  updateUsers: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      updateMany: mocks.updateUsers
    }
  }
}));

import {
  planForSubscriptionStatus,
  subscriptionPeriodEnd,
  syncStripeSubscription
} from "./billing";

function subscription(
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    customer: "cus_test",
    status: "active",
    metadata: { userId: "user-1" },
    items: {
      object: "list",
      data: [
        {
          current_period_end: 1_800_000_000
        } as Stripe.SubscriptionItem
      ],
      has_more: false,
      url: "/v1/subscription_items"
    },
    ...overrides
  } as Stripe.Subscription;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateUsers.mockResolvedValue({ count: 1 });
});

describe("billing synchronization", () => {
  it("grants Pro only for active or trialing subscriptions", () => {
    expect(planForSubscriptionStatus("active")).toBe("PRO");
    expect(planForSubscriptionStatus("trialing")).toBe("PRO");
    expect(planForSubscriptionStatus("past_due")).toBe("FREE");
    expect(planForSubscriptionStatus("canceled")).toBe("FREE");
  });

  it("uses the latest item period end", () => {
    const value = subscription({
      items: {
        object: "list",
        data: [
          { current_period_end: 1_700_000_000 } as Stripe.SubscriptionItem,
          { current_period_end: 1_800_000_000 } as Stripe.SubscriptionItem
        ],
        has_more: false,
        url: "/v1/subscription_items"
      }
    });
    expect(subscriptionPeriodEnd(value)?.getTime()).toBe(1_800_000_000_000);
  });

  it("updates the account from signed Stripe subscription data", async () => {
    await syncStripeSubscription(subscription());
    expect(mocks.updateUsers).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        billingPlan: "PRO",
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
        stripeSubscriptionStatus: "active"
      })
    });
  });
});
