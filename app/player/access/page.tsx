import { KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Spielerzugang · CoachOS",
  robots: { index: false, follow: false }
};

interface PlayerAccessPageProps {
  searchParams?: Promise<{ error?: string }>;
}

export default async function PlayerAccessPage({
  searchParams
}: PlayerAccessPageProps) {
  const { error } = (await searchParams) ?? {};
  return (
    <main className="grid min-h-dvh place-items-center bg-secondary/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <KeyRound aria-hidden="true" className="h-5 w-5" />
          </div>
          <CardTitle>Spieler- oder Elternzugang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              Dieser Zugangslink ist ungültig oder wurde erneuert.
            </p>
          ) : null}
          <p>
            Öffne den persönlichen Zugangslink, den du von deinem Trainerteam
            erhalten hast. Danach bleibt dieses Gerät sicher angemeldet.
          </p>
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-900">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Der persönliche Schlüssel wird nicht in der normalen App-Adresse
            gespeichert.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
