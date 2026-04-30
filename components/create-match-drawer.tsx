"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { createMatch } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const steps = ["Termin", "Aufgebot", "Plan"] as const;
const formations = ["4-3-3", "4-2-3-1", "3-5-2", "4-4-2", "3-4-3"] as const;

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
            "rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary",
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

export function CreateMatchDrawer({
  initialDate,
  suggestedLineup,
  suggestedSubstitutes
}: {
  initialDate: string;
  suggestedLineup: string;
  suggestedSubstitutes: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  function close() {
    setIsOpen(false);
    setStep(0);
  }

  return (
    <>
      <Card className="h-fit border-emerald-200 bg-emerald-50/70">
        <CardHeader>
          <CardTitle>Spiel planen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-emerald-950/80">
            Geführter Matchday-Flow mit Termin, Aufgebot, Formation und Zielen.
          </p>
          <Button className="w-full" onClick={() => setIsOpen(true)} type="button">
            <Trophy aria-hidden="true" className="h-4 w-4" />
            Spiel planen
          </Button>
        </CardContent>
      </Card>

      <SideDrawer
        description="Plane zuerst das Nötige. Details wie Notizen und Fazit kannst du später im Spiel bearbeiten."
        eyebrow="Matchday"
        isOpen={isOpen}
        onClose={close}
        title="Neues Spiel"
      >
        <form action={createMatch} className="space-y-5" onSubmit={close}>
          <StepTabs currentStep={step} setStep={setStep} />

          <section className={cn("space-y-4", step !== 0 && "hidden")}>
            <div className="space-y-2">
              <Label htmlFor="drawer-match-opponent">Gegner</Label>
              <Input
                id="drawer-match-opponent"
                name="opponent"
                placeholder="FC Beispiel"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-match-date">Datum</Label>
                <Input
                  defaultValue={initialDate}
                  id="drawer-match-date"
                  name="date"
                  required
                  type="date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-match-time">Kickoff</Label>
                <Input id="drawer-match-time" name="kickoff_time" type="time" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="location" placeholder="Ort" />
              <Input name="meeting_point" placeholder="Treffpunkt" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue="home"
                name="home_away"
              >
                <option value="home">Heim</option>
                <option value="away">Auswärts</option>
                <option value="neutral">Neutral</option>
              </select>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue="4-3-3"
                name="formation"
              >
                {formations.map((formation) => (
                  <option key={formation} value={formation}>
                    {formation}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className={cn("space-y-4", step !== 1 && "hidden")}>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Aufgebot</p>
                <Badge variant="secondary">aus Kader vorbefüllt</Badge>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="drawer-match-lineup">Startelf</Label>
                  <Textarea
                    defaultValue={suggestedLineup}
                    id="drawer-match-lineup"
                    name="starting_lineup"
                    placeholder="Ein Spieler pro Zeile"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-match-subs">Ersatzspieler</Label>
                  <Textarea
                    defaultValue={suggestedSubstitutes}
                    id="drawer-match-subs"
                    name="substitutes"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={cn("space-y-4", step !== 2 && "hidden")}>
            <div className="space-y-2">
              <Label htmlFor="drawer-match-goals">Matchziele</Label>
              <Textarea
                id="drawer-match-goals"
                name="match_goals"
                placeholder="2-3 klare Ziele für das Spiel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawer-match-tactics">Taktische Vorgaben</Label>
              <Textarea
                id="drawer-match-tactics"
                name="tactical_instructions"
                placeholder="Pressingtrigger, Aufbauidee, Verhalten gegen Ball"
              />
            </div>
            <Textarea
              name="squad_notes"
              placeholder="Aufgebot / Kadernotizen optional"
            />
            <Textarea
              name="pre_match_notes"
              placeholder="Vor-dem-Spiel-Notizen optional"
            />
          </section>

          <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-border bg-white px-5 py-4">
            <Button
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
                onClick={() =>
                  setStep((current) => Math.min(steps.length - 1, current + 1))
                }
                type="button"
              >
                Weiter
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit">
                <Check aria-hidden="true" className="h-4 w-4" />
                Spiel speichern
              </Button>
            )}
          </div>
        </form>
      </SideDrawer>
    </>
  );
}
