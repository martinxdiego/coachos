"use client";

import { useState } from "react";
import { CalendarPlus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createTraining } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-secondary p-1">
      {steps.map((step, index) => (
        <button
          className={cn(
            "rounded-xl px-3 py-2 text-[13px] font-medium tracking-tight transition-colors duration-200 ease-spring active:scale-[0.97]",
            currentStep === index
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
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
      <Button onClick={() => setIsOpen(true)} type="button">
        <CalendarPlus aria-hidden="true" className="h-4 w-4" />
        Training erstellen
      </Button>

      <SideDrawer
        description="Plane schnell eine nutzbare Einheit, ohne dich sofort durch alle Detailfelder zu kämpfen."
        eyebrow="Training"
        isOpen={isOpen}
        onClose={close}
        title="Neues Training"
      >
        <ToastForm
          action={createTraining}
          className="space-y-5"
          onComplete={close}
          successMessage="Training erstellt"
        >
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
                  className="flex h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-sm focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
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
            <div className="space-y-2">
              <Label htmlFor="drawer-training-participants">Teilnehmer</Label>
              <Input
                id="drawer-training-participants"
                name="participants"
                placeholder="alle Feldspieler"
              />
            </div>
          </section>

          <section className={cn("space-y-3", step !== 1 && "hidden")}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-semibold tracking-tight">
                Ablauf als Timeline
              </p>
              <Badge variant="secondary">Optional anpassen</Badge>
            </div>
            {phases.map((phase) => (
              <div
                className="rounded-2xl border border-border/70 bg-card p-3"
                key={phase.type}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold tracking-tight">
                    {phase.label}
                  </p>
                  <Input
                    aria-label={`${phase.label} Dauer`}
                    className="w-24"
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
                  <Input
                    name={`${phase.type}_material`}
                    placeholder="Material"
                  />
                </div>
              </div>
            ))}
          </section>

          <section className={cn("space-y-4", step !== 2 && "hidden")}>
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-[13px] leading-6 text-emerald-900">
              Die Einheit wird mit Basisdaten und allen ausgefüllten Phasen
              gespeichert. Danach kannst du sie in der Trainingsübersicht weiter
              bearbeiten, duplizieren oder drucken.
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input name="is_template" type="checkbox" />
              Zusätzlich als Vorlage markieren
            </label>
            <Input name="template_name" placeholder="Vorlagenname optional" />
            <Textarea name="notes" placeholder="Interne Notizen optional" />
          </section>

          <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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
                onClick={() => {
                  if (step === 0) {
                    const focusEl = document.getElementById("drawer-training-focus") as HTMLInputElement | null;
                    if (!focusEl?.value.trim()) {
                      focusEl?.focus();
                      toast.error("Bitte Schwerpunkt eingeben");
                      return;
                    }
                  }
                  setStep((current) => Math.min(steps.length - 1, current + 1));
                }}
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
        </ToastForm>
      </SideDrawer>
    </>
  );
}
