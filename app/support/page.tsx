import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  LifeBuoy,
  Mail,
  MessageSquareHeart,
  ShieldAlert,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Support · CoachOS"
};

export default function SupportPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const configuredPrivacyUrl = process.env.NEXT_PUBLIC_PRIVACY_URL;
  const privacyUrl =
    configuredPrivacyUrl &&
    /^https?:\/\//.test(configuredPrivacyUrl) &&
    !/[<>]/.test(configuredPrivacyUrl)
      ? configuredPrivacyUrl
      : null;

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
              <h2 className="font-semibold">Direkt zum Ziel</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    href: "/players",
                    title: "Kader einrichten",
                    body: "Spieler anlegen, importieren und Zugänge verwalten.",
                    icon: UsersRound
                  },
                  {
                    href: "/trainings",
                    title: "Training planen",
                    body: "Einheiten, Phasen und Vorlagen effizient nutzen.",
                    icon: ClipboardList
                  },
                  {
                    href: "/calendar",
                    title: "Kalender nutzen",
                    body: "Termine anzeigen und als ICS-Datei exportieren.",
                    icon: CalendarDays
                  },
                  {
                    href: "/feedback",
                    title: "Feedback senden",
                    body: "Idee, Lob oder technisches Problem direkt melden.",
                    icon: MessageSquareHeart
                  }
                ].map((guide) => {
                  const Icon = guide.icon;
                  return (
                    <Link
                      className="rounded-xl border border-border p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                      href={guide.href}
                      key={guide.href}
                    >
                      <Icon className="h-5 w-5 text-emerald-700" />
                      <h3 className="mt-2 font-semibold">{guide.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{guide.body}</p>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="border-t border-border pt-5">
              <h2 className="font-semibold">Häufige Fragen</h2>
              <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                {[
                  {
                    question: "Wie bekomme ich CoachOS auf den Handy-Startbildschirm?",
                    answer: "Öffne CoachOS in Safari oder Chrome und wähle im Browsermenü „Zum Home-Bildschirm“ beziehungsweise „App installieren“."
                  },
                  {
                    question: "Wie teile ich den Spielerbereich sicher?",
                    answer: "Öffne das Spielerprofil und teile nur den persönlichen Zugangslink. Bei Verlust kannst du ihn dort sofort erneuern; alte Geräte werden dadurch abgemeldet."
                  },
                  {
                    question: "Wie übernehme ich Termine in meinen Kalender?",
                    answer: "Nutze im CoachOS-Kalender „Kalender exportieren“. Die heruntergeladene ICS-Datei lässt sich in Apple Kalender, Google Kalender und Outlook importieren."
                  },
                  {
                    question: "Wer kann sensible Gesundheitsdaten sehen?",
                    answer: "Gesundheitsdaten bleiben im geschützten Workspace. Teile sie nicht per E-Mail und prüfe Mitglieder sowie Zugänge regelmäßig in den Workspace-Einstellungen."
                  }
                ].map((item) => (
                  <details className="group px-4 py-3" key={item.question}>
                    <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-3">
                        {item.question}
                        <span className="text-lg text-muted-foreground transition group-open:rotate-45">+</span>
                      </span>
                    </summary>
                    <p className="mt-2 pr-6 text-muted-foreground">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>

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
                <Button asChild className="mt-3" variant="outline">
                  <Link href="/feedback">
                    <MessageSquareHeart aria-hidden="true" className="h-4 w-4" />
                    Problem direkt melden
                  </Link>
                </Button>
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
