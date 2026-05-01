"use client";

import { useState } from "react";
import {
  CalendarPlus,
  ClipboardList,
  HeartPulse,
  Medal,
  Plus,
  Trophy,
  UserPlus,
  X
} from "lucide-react";
import {
  addWinnerPoints,
  createMatch,
  createPlayer,
  createTask,
  createTraining,
  saveHealthCheckin
} from "@/app/actions";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, todayIsoDate } from "@/lib/utils";

type QuickCreateMode =
  | "player"
  | "training"
  | "match"
  | "winner"
  | "health"
  | "task";

type QuickPlayer = {
  id: string;
  name: string;
  position: string | null;
};

const quickCreateModes = [
  { id: "player", label: "Spieler", icon: UserPlus },
  { id: "training", label: "Training", icon: CalendarPlus },
  { id: "match", label: "Spiel", icon: Trophy },
  { id: "winner", label: "Winner", icon: Medal },
  { id: "health", label: "Check-in", icon: HeartPulse },
  { id: "task", label: "Aufgabe", icon: ClipboardList }
] satisfies { id: QuickCreateMode; label: string; icon: typeof Plus }[];

function ModeButton({
  active,
  label,
  onClick,
  icon: Icon
}: {
  active: boolean;
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card text-[13px] font-medium tracking-tight transition-colors duration-200 ease-spring active:scale-[0.97] hover:border-primary/40",
        active && "border-slate-950 bg-slate-950 text-white hover:border-slate-950"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </button>
  );
}

export function QuickCreate({
  enabled,
  players
}: {
  enabled: boolean;
  players: QuickPlayer[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<QuickCreateMode>("training");
  const today = todayIsoDate();

  if (!enabled) {
    return null;
  }

  return (
    <>
      <button
        aria-label="Schnell erstellen"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_32px_rgba(16,185,129,0.32),0_2px_6px_rgba(15,23,42,0.18)] transition-transform duration-200 ease-spring hover:scale-105 active:scale-95 md:bottom-7 md:right-7"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Plus aria-hidden="true" className="h-6 w-6" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Schnell erstellen schließen"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <section className="absolute bottom-0 right-0 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card/95 p-6 shadow-elevated backdrop-blur-xl animate-slide-up md:bottom-5 md:right-5 md:w-[460px] md:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                  Schnellerfassung
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  Was möchtest du anlegen?
                </h2>
              </div>
              <Button
                aria-label="Schließen"
                onClick={() => setIsOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickCreateModes.map((item) => (
                <ModeButton
                  active={mode === item.id}
                  icon={item.icon}
                  key={item.id}
                  label={item.label}
                  onClick={() => setMode(item.id)}
                />
              ))}
            </div>

            <div className="mt-5">
              {mode === "player" ? (
                <ToastForm
                  action={createPlayer}
                  className="space-y-4"
                  onComplete={() => setIsOpen(false)}
                  successMessage="Spieler gespeichert"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="qc-first-name">Vorname</Label>
                      <Input id="qc-first-name" name="first_name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qc-last-name">Nachname</Label>
                      <Input id="qc-last-name" name="last_name" required />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input name="position" placeholder="Position" />
                    <Input name="birth_year" placeholder="Jahrgang" type="number" />
                    <Input name="jersey_number" placeholder="Nummer" type="number" />
                  </div>
                  <Button className="w-full" type="submit">
                    Spieler speichern
                  </Button>
                </ToastForm>
              ) : null}

              {mode === "training" ? (
                <ToastForm
                  action={createTraining}
                  className="space-y-4"
                  onComplete={() => setIsOpen(false)}
                  successMessage="Training erstellt"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input defaultValue={today} name="date" required type="date" />
                    <Input name="start_time" type="time" />
                  </div>
                  <Input
                    name="focus"
                    placeholder="Schwerpunkt, z.B. Pressing"
                    required
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input defaultValue="90" name="duration_minutes" type="number" />
                    <Input name="location" placeholder="Ort" />
                  </div>
                  <Textarea name="goal" placeholder="Trainingsziel optional" />
                  <Button className="w-full" type="submit">
                    Training erstellen
                  </Button>
                </ToastForm>
              ) : null}

              {mode === "match" ? (
                <ToastForm
                  action={createMatch}
                  className="space-y-4"
                  onComplete={() => setIsOpen(false)}
                  successMessage="Spiel geplant"
                >
                  <Input name="opponent" placeholder="Gegner" required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input defaultValue={today} name="date" required type="date" />
                    <Input name="kickoff_time" type="time" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input name="location" placeholder="Ort" />
                    <Input name="meeting_point" placeholder="Treffpunkt" />
                  </div>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="4-3-3"
                    name="formation"
                  >
                    <option value="4-3-3">4-3-3</option>
                    <option value="4-2-3-1">4-2-3-1</option>
                    <option value="3-5-2">3-5-2</option>
                    <option value="4-4-2">4-4-2</option>
                  </select>
                  <Button className="w-full" type="submit">
                    Spiel planen
                  </Button>
                </ToastForm>
              ) : null}

              {mode === "winner" ? (
                players.length > 0 ? (
                  <ToastForm
                    action={addWinnerPoints}
                    className="space-y-4"
                    onComplete={() => setIsOpen(false)}
                    successMessage="Winnerpunkte gespeichert"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        name="player_id"
                        required
                      >
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                            {player.position ? ` · ${player.position}` : ""}
                          </option>
                        ))}
                      </select>
                      <Input
                        defaultValue="3"
                        max={50}
                        min={1}
                        name="points"
                        type="number"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        defaultValue="training"
                        name="context_type"
                      >
                        <option value="training">Training</option>
                        <option value="match">Spiel</option>
                        <option value="event">Event</option>
                        <option value="monday_training">Montag</option>
                        <option value="other">Sonstiges</option>
                      </select>
                      <Input defaultValue={today} name="awarded_at" type="date" />
                    </div>
                    <Input
                      name="context_label"
                      placeholder="Kontext, Gegner oder Event"
                    />
                    <Textarea name="reason" placeholder="Begründung optional" />
                    <Button className="w-full" type="submit">
                      Winnerpunkte speichern
                    </Button>
                  </ToastForm>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Erfasse zuerst Spieler, damit Winnerpunkte vergeben werden
                    können.
                  </p>
                )
              ) : null}

              {mode === "health" ? (
                players.length > 0 ? (
                  <ToastForm
                    action={saveHealthCheckin}
                    className="space-y-4"
                    onComplete={() => setIsOpen(false)}
                    successMessage="Check-in gespeichert"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        name="player_id"
                        required
                      >
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                      </select>
                      <Input defaultValue={today} name="checkin_date" type="date" />
                    </div>
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue="training"
                      name="context_type"
                    >
                      <option value="training">Vor Training</option>
                      <option value="match">Vor Spiel</option>
                      <option value="free">Freier Check</option>
                    </select>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["fatigue", "Müdigkeit"],
                        ["sleep_quality", "Schlaf"],
                        ["soreness", "Muskel"],
                        ["pain", "Schmerz"],
                        ["stress", "Stress"],
                        ["motivation", "Motivation"],
                        ["energy", "Energie"],
                        ["injury_feeling", "Verletzung"],
                        ["wellbeing", "Wohlbefinden"]
                      ].map(([name, label]) => (
                        <label className="space-y-1 text-xs" key={name}>
                          <span>{label}</span>
                          <select
                            className="flex h-9 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            defaultValue="3"
                            name={name}
                          >
                            {[1, 2, 3, 4, 5].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <Textarea name="notes" placeholder="Hinweis optional" />
                    <Button className="w-full" type="submit">
                      Check-in speichern
                    </Button>
                  </ToastForm>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Erfasse zuerst Spieler, damit Check-ins gespeichert werden
                    können.
                  </p>
                )
              ) : null}

              {mode === "task" ? (
                <ToastForm
                  action={createTask}
                  className="space-y-4"
                  onComplete={() => setIsOpen(false)}
                  successMessage="Aufgabe erstellt"
                >
                  <Input name="title" placeholder="Aufgabe" required />
                  <Input name="due_date" type="date" />
                  <Button className="w-full" type="submit">
                    Aufgabe erstellen
                  </Button>
                </ToastForm>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
