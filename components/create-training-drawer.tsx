"use client";

import { useState } from "react";
import { CalendarPlus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { createTraining } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TrainingPhaseType } from "@/lib/types";

const steps = ["Basis", "Ablauf", "Review"] as const;

const phases: {
  defaultDuration: number;
  label: string;
  placeholder: string;
  type: TrainingPhaseType;
}[] = [
  {
    type: "warmup",
    label: "Warm-up",
    defaultDuration: 12,
    placeholder: "Aktivierung, Rondos, Mobilität"
  },
  {
    type: "technique",
    label: "Technik",
    defaultDuration: 15,
    placeholder: "Wiederholungen, erster Kontakt, Passqualität"
  },
  {
    type: "tactics",
    label: "Taktik",
    defaultDuration: 20,
    placeholder: "Prinzip, Positionierung, Korrekturpunkte"
  },
  {
    type: "game_form",
    label: "Spielform",
    defaultDuration: 25,
    placeholder: "Realistische Spielform mit Zielregel"
  },
  {
    type: "finish",
    label: "Abschluss",
    defaultDuration: 12,
    placeholder: "Wettkampf, Torabschluss, Transfer"
  },
  {
    type: "cooldown",
    label: "Cooldown",
    defaultDuration: 6,
    placeholder: "Review, Regeneration, Spielerfeedback"
  }
];

function StepTabs({
  currentStep,
  setStep
}: {
  currentStep: number;
  setStep: (step: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((step, index) => (
        <button
          className={cn(
            "min-w-0 rounded-lg border border-border px-2 py-2 text-xs font-medium transition hover:bg-secondary sm:px-3 sm:text-sm",
            currentStep === index &&
              "border-slate-950 bg-slate-950 text-white hover:bg-slate-900"
          )}
          key={step}
          onClick={() => setStep(index)}
          type="button"
        >
          {index + 1}. {step}
        </button>
      ))}
    </div>
  );
}

export function CreateTrainingDrawer({
  ageGroup,
  initialDate
}: {
  ageGroup: string | null;
  initialDate: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  function close() {
    setIsOpen(false);
    setStep(0);
  }

  return (
    <>
      <Card className="border-emerald-200 bg-emerald-50/70">
        <CardHeader>
          <CardTitle>Training planen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-emerald-950/80">
            Geführter 3-Schritt-Flow: Basisdaten, Ablaufphasen, speichern.
          </p>
          <Button className="w-full" onClick={() => setIsOpen(true)} type="button">
            <CalendarPlus aria-hidden="true" className="h-4 w-4" />
            Training erstellen
          </Button>
        </CardContent>
      </Card>

      <SideDrawer
        description="Plane schnell eine nutzbare Einheit, ohne dich sofort durch alle Detailfelder zu kämpfen."
        eyebrow="Training"
        isOpen={isOpen}
        onClose={close}
        title="Neues Training"
      >
        <form action={createTraining} className="space-y-5" onSubmit={close}>
          <StepTabs currentStep={step} setStep={setStep} />

          <section className={cn("space-y-4", step !== 0 && "hidden")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-training-date">Datum</Label>
                <Input
                  defaultValue={initialDate}
                  id="drawer-training-date"
                  name="date"
                  required
                  type="date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-training-time">Uhrzeit</Label>
                <Input id="drawer-training-time" name="start_time" type="time" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-training-duration">Dauer</Label>
                <Input
                  defaultValue="90"
                  id="drawer-training-duration"
                  name="duration_minutes"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-training-location">Ort</Label>
                <Input
                  id="drawer-training-location"
                  name="location"
                  placeholder="Platz 2"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawer-training-focus">Schwerpunkt</Label>
              <Input
                id="drawer-training-focus"
                name="focus"
                placeholder="Pressing nach Ballverlust"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawer-training-goal">Trainingsziel</Label>
              <Textarea
                id="drawer-training-goal"
                name="goal"
                placeholder="Was soll die Mannschaft nach der Einheit besser können?"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-training-age">Altersstufe</Label>
                <Input
                  defaultValue={ageGroup ?? ""}
                  id="drawer-training-age"
                  name="age_group"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-training-intensity">Intensität</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue="medium"
                  id="drawer-training-intensity"
                  name="intensity"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>
            <Input
              name="participants"
              placeholder="Teilnehmer, z.B. alle Feldspieler"
            />
          </section>

          <section className={cn("space-y-3", step !== 1 && "hidden")}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Ablauf als Timeline</p>
              <Badge variant="secondary">Optional anpassen</Badge>
            </div>
            {phases.map((phase) => (
              <div
                className="rounded-xl border border-border bg-background/70 p-3"
                key={phase.type}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{phase.label}</p>
                  <Input
                    className="w-20 sm:w-24"
                    defaultValue={phase.defaultDuration}
                    name={`${phase.type}_duration`}
                    type="number"
                  />
                </div>
                <Input
                  className="mt-3"
                  defaultValue={phase.label}
                  name={`${phase.type}_title`}
                  placeholder={`${phase.label} Titel`}
                />
                <Textarea
                  className="mt-3 min-h-20"
                  name={`${phase.type}_description`}
                  placeholder={phase.placeholder}
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Input
                    name={`${phase.type}_coaching`}
                    placeholder="Coachingpunkte"
                  />
                  <Input name={`${phase.type}_material`} placeholder="Material" />
                </div>
              </div>
            ))}
          </section>

          <section className={cn("space-y-4", step !== 2 && "hidden")}>
            <div className="rounded-xl border border-border bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              Die Einheit wird mit Basisdaten und allen ausgefüllten Phasen
              gespeichert. Danach kannst du sie in der Trainingsübersicht weiter
              bearbeiten, duplizieren oder drucken.
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="is_template" type="checkbox" />
              Zusätzlich als Vorlage markieren
            </label>
            <Input name="template_name" placeholder="Vorlagenname optional" />
            <Textarea name="notes" placeholder="Interne Notizen optional" />
          </section>

          <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-white/95 px-4 py-4 backdrop-blur sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <Button
              className="w-full sm:w-auto"
              disabled={step === 0}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Zurück
            </Button>
            {step < steps.length - 1 ? (
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  setStep((current) => Math.min(steps.length - 1, current + 1))
                }
                type="button"
              >
                Weiter
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="w-full sm:w-auto" type="submit">
                <Check aria-hidden="true" className="h-4 w-4" />
                Training speichern
              </Button>
            )}
          </div>
        </form>
      </SideDrawer>
    </>
  );
}
