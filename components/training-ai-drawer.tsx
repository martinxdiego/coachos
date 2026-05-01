"use client";

import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { createAiTrainingDraft } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrainingAiDraftDrawer({
  ageGroup,
  initialDate
}: {
  ageGroup: string | null;
  initialDate: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        type="button"
        variant="outline"
      >
        <Sparkles aria-hidden="true" className="h-4 w-4" />
        KI-Draft
      </Button>

      <SideDrawer
        description="Generiert ein strukturiertes Training mit Phasen, Coachingpunkten und Material. Aktuell als Mock-Entwurf, vorbereitet für echte Modellintegration."
        eyebrow="Training"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="KI-Trainingsentwurf"
      >
        <ToastForm
          action={createAiTrainingDraft}
          className="space-y-5"
          onComplete={() => setIsOpen(false)}
          successMessage="KI-Entwurf erstellt"
        >
          <div className="space-y-2">
            <Label htmlFor="ai-focus">Ziel oder Schwerpunkt</Label>
            <Input
              autoFocus
              id="ai-focus"
              name="focus"
              placeholder="Spielaufbau gegen Pressing"
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
              placeholder="U16"
            />
          </div>

          <Button className="w-full" type="submit">
            <Bot aria-hidden="true" className="h-4 w-4" />
            Entwurf erzeugen
          </Button>
        </ToastForm>
      </SideDrawer>
    </>
  );
}
