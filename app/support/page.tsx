import Link from "next/link";
import { ArrowLeft, LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Support · CoachOS"
};

export default function SupportPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_URL;

  return (
    <main className="min-h-dvh bg-secondary/30 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <Button asChild size="sm" variant="ghost">
          <Link href="/">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Zur App
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-800">
                <LifeBuoy aria-hidden="true" className="h-5 w-5" />
              </div>
              <CardTitle>Hilfe &amp; Support</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-6">
            <section>
              <h2 className="font-semibold">Zugang oder technisches Problem</h2>
              <p className="mt-1 text-muted-foreground">
                Beschreibe Gerät, Browser, Zeitpunkt und den letzten Schritt.
                Sende keine Passwörter, persönlichen Zugangslinks oder
                Gesundheitsdaten per E-Mail.
              </p>
              {supportEmail ? (
                <Button asChild className="mt-3">
                  <a href={`mailto:${supportEmail}?subject=CoachOS Support`}>
                    <Mail aria-hidden="true" className="h-4 w-4" />
                    {supportEmail}
                  </a>
                </Button>
              ) : (
                <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  Der Supportkontakt wird vor dem produktiven Start hinterlegt.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border p-4">
              <h2 className="font-semibold">Datenanfrage oder Löschung</h2>
              <p className="mt-1 text-muted-foreground">
                Workspace-Owner können unter „Workspaces → Daten &
                Datenschutz“ ein vollständiges Archiv herunterladen oder den
                Workspace dauerhaft löschen.
              </p>
            </section>

            <section className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4">
              <ShieldAlert
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
              />
              <div>
                <h2 className="font-semibold">Sicherheitsvorfall</h2>
                <p className="mt-1 text-muted-foreground">
                  Bei einem verlorenen Spielerlink den Zugang im Spielerprofil
                  sofort erneuern. Dadurch werden alle aktiven Geräte und
                  Push-Abonnements widerrufen.
                </p>
              </div>
            </section>

            {privacyUrl ? (
              <a
                className="font-medium text-emerald-700 underline"
                href={privacyUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Datenschutzerklärung öffnen
              </a>
            ) : null}
            <div className="flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
              <Link className="font-medium text-emerald-700 underline" href="/legal/privacy">
                Datenschutz
              </Link>
              <Link className="font-medium text-emerald-700 underline" href="/legal/imprint">
                Impressum
              </Link>
              <Link className="font-medium text-emerald-700 underline" href="/legal/terms">
                Nutzungsbedingungen
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
