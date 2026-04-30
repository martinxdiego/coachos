"use client";

import { useState } from "react";
import {
  CalendarPlus,
  ClipboardList,
  Plus,
  Trophy,
  UserPlus,
  X
} from "lucide-react";
import {
  createMatch,
  createPlayer,
  createTask,
  createTraining
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, todayIsoDate } from "@/lib/utils";

type QuickCreateMode = "player" | "training" | "match" | "task";

const quickCreateModes = [
  { id: "player", label: "Spieler", icon: UserPlus },
  { id: "training", label: "Training", icon: CalendarPlus },
  { id: "match", label: "Spiel", icon: Trophy },
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
        "flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary/40",
        active && "border-slate-950 bg-slate-950 text-white hover:bg-slate-900"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </button>
  );
}

export function QuickCreate({ enabled }: { enabled: boolean }) {
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
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-400 md:bottom-7 md:right-7"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Plus aria-hidden="true" className="h-6 w-6" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Quick Create schließen"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <section className="absolute bottom-0 right-0 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:bottom-5 md:right-5 md:w-[460px] md:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary">
                  Quick Create
                </p>
                <h2 className="mt-1 text-xl font-semibold">Schnell erfassen</h2>
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

            <div className="mt-5 grid grid-cols-2 gap-2">
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
                <form
                  action={createPlayer}
                  className="space-y-4"
                  onSubmit={() => setIsOpen(false)}
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
                </form>
              ) : null}

              {mode === "training" ? (
                <form
                  action={createTraining}
                  className="space-y-4"
                  onSubmit={() => setIsOpen(false)}
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
                </form>
              ) : null}

              {mode === "match" ? (
                <form
                  action={createMatch}
                  className="space-y-4"
                  onSubmit={() => setIsOpen(false)}
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
                </form>
              ) : null}

              {mode === "task" ? (
                <form
                  action={createTask}
                  className="space-y-4"
                  onSubmit={() => setIsOpen(false)}
                >
                  <Input name="title" placeholder="Aufgabe" required />
                  <Input name="due_date" type="date" />
                  <Button className="w-full" type="submit">
                    Aufgabe erstellen
                  </Button>
                </form>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
