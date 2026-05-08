"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, HeartPulse } from "lucide-react";
import { saveHealthCheckin } from "@/app/actions";
import { ScoreScale } from "@/components/score-scale";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate, todayIsoDate } from "@/lib/utils";

type Direction = "low-good" | "high-good";

const checks: ReadonlyArray<readonly [string, string, Direction]> = [
  ["wellbeing", "Wohlbefinden", "high-good"],
  ["fatigue", "Müdigkeit", "low-good"],
  ["sleep_quality", "Schlaf", "high-good"],
  ["energy", "Energie", "high-good"],
  ["pain", "Schmerzen", "low-good"],
  ["soreness", "Muskelkater", "low-good"],
  ["stress", "Stress", "low-good"],
  ["motivation", "Motivation", "high-good"],
  ["injury_feeling", "Verletzungsgefühl", "low-good"]
];

interface PlayerModeCheckinProps {
  playerId: string;
  todayCheckin: Record<string, unknown> | null;
  alreadyDone: boolean;
}

export function PlayerModeCheckin({
  playerId,
  todayCheckin,
  alreadyDone
}: PlayerModeCheckinProps) {
  const [expanded, setExpanded] = useState(!alreadyDone);
  const today = todayIsoDate();

  function readScale(key: string) {
    const raw = todayCheckin?.[key];
    const value = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(value) ? value : 3;
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-soft transition-colors",
        alreadyDone
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-emerald-300 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-emerald-500/0"
      )}
    >
      <button
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl shadow-sm",
              alreadyDone
                ? "bg-emerald-600 text-white"
                : "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30"
            )}
          >
            {alreadyDone ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <HeartPulse className="h-6 w-6" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Heute · {formatDate(today)}
            </p>
            <p className="mt-0.5 text-[17px] font-semibold tracking-tight">
              {alreadyDone ? "Check-in erledigt" : "Wie fühlst du dich heute?"}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {alreadyDone
                ? "Tippe, um deinen Eintrag zu bearbeiten."
                : "9 Fragen · ungefähr 30 Sekunden"}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp aria-hidden="true" className="h-5 w-5 text-foreground/60" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-5 w-5 text-foreground/60" />
        )}
      </button>

      {expanded ? (
        <div className="border-t border-emerald-200/70 bg-white px-4 py-5">
          <ToastForm
            action={saveHealthCheckin}
            className="space-y-4"
            onComplete={() => setExpanded(false)}
            successMessage="Danke! Check-in gespeichert."
          >
            <input name="player_id" type="hidden" value={playerId} />
            <input name="checkin_date" type="hidden" value={today} />
            <input
              name="context_type"
              type="hidden"
              value={(todayCheckin?.context_type as string) ?? "training"}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {checks.map(([name, label, direction]) => (
                <ScoreScale
                  defaultValue={readScale(name)}
                  direction={direction}
                  key={name}
                  label={label}
                  name={name}
                />
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-medium tracking-tight" htmlFor="player-mode-notes">
                Notiz an den Trainer (optional)
              </label>
              <Textarea
                defaultValue={(todayCheckin?.notes as string) ?? ""}
                id="player-mode-notes"
                name="notes"
                placeholder="Z.B. Knie zwickt seit gestern."
              />
            </div>

            <Button className="h-12 w-full text-[15px]" type="submit">
              {alreadyDone ? "Check-in aktualisieren" : "Check-in speichern"}
            </Button>
          </ToastForm>
        </div>
      ) : null}
    </section>
  );
}
