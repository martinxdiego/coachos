CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'PRO');

ALTER TABLE "User"
ADD COLUMN "billingPlan" "BillingPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "stripeSubscriptionStatus" TEXT,
ADD COLUMN "subscriptionCurrentPeriodEnd" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_stripeCustomerId_key"
ON "User"("stripeCustomerId");

CREATE UNIQUE INDEX "User_stripeSubscriptionId_key"
ON "User"("stripeSubscriptionId");
