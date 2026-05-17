"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { createAiTrainingDraft } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function TrainingAiDraftDrawer({
  ageGroup,
  initialDate
}: {
  ageGroup: string | null;
  initialDate: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await createAiTrainingDraft(formData);
        toast.success("KI-Trainingsplan erstellt");
        setIsOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Generierung fehlgeschlagen.");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button" variant="outline">
        <Sparkles aria-hidden="true" className="h-4 w-4" />
        KI-Plan
      </Button>

      <SideDrawer
        description="Claude analysiert die aktuellen Wellness-Daten deines Teams, die letzten Trainings und das nächste Spiel — und generiert daraus einen vollständigen, belastungsoptimierten Trainingsplan."
        eyebrow="KI · Claude Opus"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="KI-Trainingsplan"
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="ai-focus">Schwerpunkt</Label>
            <Input
              autoFocus
              id="ai-focus"
              name="focus"
              placeholder="z.B. Spielaufbau gegen Pressing"
              required
            />
            <p className="text-[12px] leading-5 text-muted-foreground">
              Je präziser der Schwerpunkt, desto fokussierter das Ergebnis.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-date">Datum</Label>
              <Input
                defaultValue={initialDate}
                id="ai-date"
                name="date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-duration">Dauer (Minuten)</Label>
              <Input
                defaultValue="90"
                id="ai-duration"
                name="duration_minutes"
                min="30"
                max="180"
                type="number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-age">Altersstufe</Label>
            <Input
              defaultValue={ageGroup ?? ""}
              id="ai-age"
              name="age_group"
              placeholder="z.B. U16"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-context">Zusätzliche Anweisungen (optional)</Label>
            <Textarea
              id="ai-context"
              name="context"
              placeholder="z.B. Wir haben Mittwoch ein wichtiges Spiel, heute nur leichte Belastung. Oder: Fokus auf Standardsituationen einbauen."
              rows={3}
            />
            <p className="text-[12px] leading-5 text-muted-foreground">
              Hinweise zum Spielplan, besonderen Spielern oder taktischen Wünschen.
            </p>
          </div>

          {/* Was die KI analysiert */}
          <div className="rounded-xl border border-border/60 bg-secondary/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Die KI analysiert automatisch
            </p>
            <ul className="mt-2 space-y-1">
              {[
                "Wellness-Werte aller Spieler (letzte 7 Tage)",
                "Kader-Status: fit / eingeschränkt / verletzt",
                "Letzte 4 Trainings (Intensität + Schwerpunkt)",
                "Nächstes Spiel und verbleibende Tage",
              ].map((item) => (
                <li className="flex items-center gap-2 text-[12px] text-foreground/80" key={item}>
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Button className="w-full" disabled={isPending} type="submit">
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Claude generiert Trainingsplan…
              </>
            ) : (
              <>
                <Bot aria-hidden="true" className="h-4 w-4" />
                Trainingsplan generieren
              </>
            )}
          </Button>

          {isPending ? (
            <p className="text-center text-[12px] text-muted-foreground">
              Claude Opus analysiert dein Team und erstellt den Plan. Das dauert 10–20 Sekunden.
            </p>
          ) : null}
        </form>
      </SideDrawer>
    </>
  );
}
