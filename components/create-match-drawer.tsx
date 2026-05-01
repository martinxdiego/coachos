"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { createMatch } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function CreateMatchDrawer({
  ageGroup,
  initialDate,
  suggestedLineup,
  suggestedSubstitutes
}: {
  ageGroup: string | null;
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
      <Button onClick={() => setIsOpen(true)} type="button">
        <Trophy aria-hidden="true" className="h-4 w-4" />
        Spiel planen
      </Button>

      <SideDrawer
        description="Plane zuerst das Nötige. Details wie Notizen und Fazit kannst du später im Spiel bearbeiten."
        eyebrow="Matchday"
        isOpen={isOpen}
        onClose={close}
        title="Neues Spiel"
      >
        <ToastForm
          action={createMatch}
          className="space-y-5"
          onComplete={close}
          successMessage="Spiel geplant"
        >
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
              <div className="space-y-2">
                <Label htmlFor="drawer-match-location">Ort</Label>
                <Input id="drawer-match-location" name="location" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-match-meeting">Treffpunkt</Label>
                <Input id="drawer-match-meeting" name="meeting_point" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-match-competition">Wettbewerb</Label>
                <Input id="drawer-match-competition" name="competition" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-match-category">Team / Kategorie</Label>
                <Input
                  defaultValue={ageGroup ?? ""}
                  id="drawer-match-category"
                  name="team_category"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="drawer-match-home">Heim/Auswärts</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-sm focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
                  defaultValue="home"
                  id="drawer-match-home"
                  name="home_away"
                >
                  <option value="home">Heim</option>
                  <option value="away">Auswärts</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawer-match-formation">Formation</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-sm focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
                  defaultValue="4-3-3"
                  id="drawer-match-formation"
                  name="formation"
                >
                  {formations.map((formation) => (
                    <option key={formation} value={formation}>
                      {formation}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className={cn("space-y-4", step !== 1 && "hidden")}>
            <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-semibold tracking-tight">Aufgebot</p>
                <Badge variant="secondary">Aus Kader vorbefüllt</Badge>
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
                placeholder="2–3 klare Ziele für das Spiel"
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
              placeholder="Aufgebot- / Kadernotizen optional"
            />
            <Textarea
              name="pre_match_notes"
              placeholder="Vor-dem-Spiel-Notizen optional"
            />
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
                Spiel speichern
              </Button>
            )}
          </div>
        </ToastForm>
      </SideDrawer>
    </>
  );
}
