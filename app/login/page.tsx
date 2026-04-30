import { KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { signIn, signUp } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginPageProps {
  searchParams?: Promise<{
    message?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const message = resolvedSearchParams?.message;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-emerald-200">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Private Trainerplattform
          </div>
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal sm:text-5xl">
              Ein Workspace für Trainerteam, Planung, Taktik und Spieltag.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              CoachOS bündelt Spieler, Trainingsphasen, Spiele, Material,
              Aufgaben und Taktikboards in einem professionellen Staff-Tool.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <UsersRound aria-hidden="true" className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 font-semibold">Workspace zuerst</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Mehrere Teams, klare Trennung, schneller Wechsel.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <KeyRound aria-hidden="true" className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 font-semibold">Co-Trainer einladen</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Staff-Zugriff über einfache Invite-Codes.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 font-semibold">Privat by default</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Keine Spieler- oder Elternaccounts in dieser Version.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {message ? (
            <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4">
            <Card className="border-white/10 bg-white text-slate-950">
              <CardHeader>
                <CardTitle>Einloggen</CardTitle>
                <CardDescription>
                  Zurück in deinen aktiven Trainer-Workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={signIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-Mail</Label>
                    <Input
                      autoComplete="email"
                      id="signin-email"
                      name="email"
                      required
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Passwort</Label>
                    <Input
                      autoComplete="current-password"
                      id="signin-password"
                      name="password"
                      required
                      type="password"
                    />
                  </div>
                  <Button className="w-full" type="submit">
                    Einloggen
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/95 text-slate-950">
              <CardHeader>
                <CardTitle>Account erstellen</CardTitle>
                <CardDescription>
                  Danach erstellst du einen Workspace oder trittst per Code bei.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={signUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-Mail</Label>
                    <Input
                      autoComplete="email"
                      id="signup-email"
                      name="email"
                      required
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Passwort</Label>
                    <Input
                      autoComplete="new-password"
                      id="signup-password"
                      minLength={8}
                      name="password"
                      required
                      type="password"
                    />
                  </div>
                  <Button className="w-full" type="submit" variant="secondary">
                    Account erstellen
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
