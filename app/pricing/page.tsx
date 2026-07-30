import { Check, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openBillingPortal, startProCheckout } from "./actions";

export const dynamic = "force-dynamic";

interface PricingPageProps {
  searchParams?: Promise<{ checkout?: string; message?: string }>;
}

const freeFeatures = [
  "1 eigener Workspace",
  "Bis zu 30 Spieler",
  "Training, Spieltag und Zu-/Absagen",
  "Spieler-/Elternportal und Check-ins"
];
const proFeatures = [
  "Unbegrenzte eigene Workspaces und Kader",
  "KI-Trainingsentwürfe",
  "PDF-Exporte",
  "Priorisierter Support"
];

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const { user } = await requireUser();
  const params = (await searchParams) ?? {};
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: {
      billingPlan: true,
      stripeCustomerId: true,
      stripeSubscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true
    }
  });
  const isPro = account?.billingPlan === "PRO";
  const configured = Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID
  );
  const priceLabel = process.env.PRO_PRICE_DISPLAY ?? "Preis wird festgelegt";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
          Tarife
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          CoachOS passend zum Team
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Der Pilot bleibt ohne aktivierte Abrechnung nutzbar. Beim bezahlten
          Start werden Limits serverseitig durchgesetzt.
        </p>
      </header>

      {params.checkout === "success" ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950" role="status">
          Checkout abgeschlossen. Der Pro-Status wird nach der bestätigten
          Stripe-Webhooksynchronisierung aktiviert.
        </p>
      ) : null}
      {params.checkout === "cancelled" ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950" role="status">
          Checkout abgebrochen – es wurde nichts geändert.
        </p>
      ) : null}
      {params.message === "already-subscribed" ? (
        <p className="rounded-xl bg-secondary p-4 text-sm" role="status">
          Dieses Konto besitzt bereits ein Abonnement. Öffne zum Ändern das
          Kundenportal.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Free</CardTitle>
              {!isPro ? <Badge variant="success">Aktueller Tarif</Badge> : null}
            </div>
            <p className="text-2xl font-semibold">CHF 0</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {freeFeatures.map((feature) => (
              <p className="flex items-start gap-2 text-sm" key={feature}>
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 text-emerald-700" />
                {feature}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-emerald-300 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles aria-hidden="true" className="h-5 w-5 text-emerald-700" />
                Pro
              </CardTitle>
              {isPro ? <Badge variant="success">Aktueller Tarif</Badge> : null}
            </div>
            <p className="text-2xl font-semibold">{priceLabel}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {proFeatures.map((feature) => (
                <p className="flex items-start gap-2 text-sm" key={feature}>
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 text-emerald-700" />
                  {feature}
                </p>
              ))}
            </div>
            {account?.stripeCustomerId ? (
              <form action={openBillingPortal}>
                <Button className="w-full" type="submit" variant="outline">
                  <CreditCard aria-hidden="true" className="h-4 w-4" />
                  Abonnement verwalten
                </Button>
              </form>
            ) : (
              <form action={startProCheckout}>
                <Button className="w-full" disabled={!configured} type="submit">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  {configured ? "Pro starten" : "Zahlungen noch nicht aktiviert"}
                </Button>
              </form>
            )}
            {account?.subscriptionCurrentPeriodEnd ? (
              <p className="text-xs text-muted-foreground">
                Aktueller Abrechnungszeitraum bis{" "}
                {account.subscriptionCurrentPeriodEnd.toLocaleDateString("de-CH")}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
