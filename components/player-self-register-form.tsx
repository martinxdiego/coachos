"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { selfRegisterPlayer } from "@/app/actions-public";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PlayerSelfRegisterForm({ teamToken }: { teamToken: string }) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<{ url: string; firstName: string } | null>(null);
  const router = useRouter();

  function handle(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await selfRegisterPlayer(teamToken, formData);
        const url = `${window.location.origin}/p/${result.accessToken}`;
        const firstName = String(formData.get("first_name") ?? "").trim();
        setSuccess({ url, firstName });
        toast.success("Anmeldung erfolgreich!");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Konnte nicht speichern.";
        toast.error(message);
      }
    });
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 aria-hidden="true" className="h-8 w-8 text-emerald-700" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          Willkommen, {success.firstName}!
        </h2>
        <p className="text-[14px] leading-6 text-muted-foreground">
          Das ist <strong>dein persönlicher Link</strong>. Speichere ihn auf
          deinem Handy als Lesezeichen — nur über diesen Link kommst du in
          deinen Bereich.
        </p>
        <div className="rounded-xl border border-border bg-secondary/40 p-3 text-left text-[12px] break-all">
          {success.url}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(success.url);
                toast.success("Link kopiert");
              } catch {
                toast.error("Konnte nicht kopieren");
              }
            }}
            type="button"
            variant="outline"
          >
            <Copy aria-hidden="true" className="h-4 w-4" />
            Link kopieren
          </Button>
          <Button onClick={() => router.push(success.url)} type="button">
            Direkt öffnen
          </Button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Tipp: In Chrome/Safari auf „Zum Startbildschirm hinzufügen&ldquo;
          tippen, dann ist dein Bereich wie eine App auf dem Handy.
        </p>
      </div>
    );
  }

  return (
    <form action={handle} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">Vorname *</Label>
          <Input id="first_name" name="first_name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Nachname *</Label>
          <Input id="last_name" name="last_name" required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="birth_date">Geburtsdatum</Label>
          <Input id="birth_date" name="birth_date" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birth_year">Jahrgang</Label>
          <Input
            id="birth_year"
            inputMode="numeric"
            name="birth_year"
            placeholder="z.B. 2012"
            type="number"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="height_cm">Grösse (cm)</Label>
          <Input
            id="height_cm"
            inputMode="numeric"
            name="height_cm"
            placeholder="z.B. 165"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight_kg">Gewicht (kg)</Label>
          <Input
            id="weight_kg"
            inputMode="decimal"
            name="weight_kg"
            placeholder="z.B. 55"
            step="0.1"
            type="number"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Input id="position" name="position" placeholder="z.B. Stürmer" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jersey_number">Trikotnummer</Label>
          <Input
            id="jersey_number"
            inputMode="numeric"
            name="jersey_number"
            type="number"
          />
        </div>
      </div>

      <Button className="h-12 w-full text-[15px]" disabled={isPending} type="submit">
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Lege an…
          </>
        ) : (
          "Anmelden und Link erhalten"
        )}
      </Button>
    </form>
  );
}
