import { AlertTriangle, ShieldCheck, UserRoundX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteCoachAccount } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user } = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
          Konto
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Sicherheit und Kontodaten
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-700" />
            Angemeldetes Konto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ein Passwort-Reset beendet durch die Session-Version alle alten
            Trainer-Sitzungen.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/35">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <UserRoundX aria-hidden="true" className="h-5 w-5" />
            Konto dauerhaft löschen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-destructive/5 p-4 text-sm">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
            />
            <p>
              Eigene Workspaces müssen zuerst gelöscht oder übertragen und ein
              aktives Abo beendet werden. Danach werden Konto, Mitgliedschaften
              und persönliche Bewertungen unwiderruflich entfernt.
            </p>
          </div>
          <form action={deleteCoachAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-account-email">
                E-Mail-Adresse zur Bestätigung
              </Label>
              <Input
                autoComplete="email"
                id="delete-account-email"
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-account-password">Aktuelles Passwort</Label>
              <Input
                autoComplete="current-password"
                id="delete-account-password"
                maxLength={128}
                name="password"
                required
                type="password"
              />
            </div>
            <Button type="submit" variant="destructive">
              Konto endgültig löschen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
