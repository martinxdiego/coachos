"use client";

import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { saveHealthCheckin } from "@/app/actions";
import { ScoreScale } from "@/components/score-scale";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { triggerConfetti } from "@/lib/confetti";
import { todayIsoDate } from "@/lib/utils";

type CheckPlayer = {
  id: string;
  name: string;
};

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

export function DashboardCheckinButton({
  players
}: {
  players: CheckPlayer[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const today = todayIsoDate();

  return (
    <>
      <button
        className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-emerald-500/0 p-4 text-left shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-spring hover:-translate-y-0.5 hover:border-emerald-500/60 hover:shadow-elevated"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span className="relative flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30"
          >
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold tracking-tight text-foreground">
              Wellness-Check starten
            </span>
            <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
              Tagesform in unter 30 Sekunden
            </span>
          </span>
        </span>
      </button>

      <SideDrawer
        description="Skala 1–5 pro Kriterium · grün = ok · rot = Warnsignal."
        eyebrow="Wellness"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Schnell-Check-in"
      >
        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Erfasse zuerst Spieler, damit Check-ins gespeichert werden können.
          </p>
        ) : (
          <ToastForm
            action={saveHealthCheckin}
            className="space-y-4"
            onComplete={() => { triggerConfetti({ x: 0.5, y: 0.4 }); setTimeout(() => setIsOpen(false), 80); }}
            successMessage="Check-in gespeichert"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dash-checkin-player">Spieler</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  id="dash-checkin-player"
                  name="player_id"
                  required
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-checkin-date">Datum</Label>
                <Input
                  defaultValue={today}
                  id="dash-checkin-date"
                  name="checkin_date"
                  type="date"
                />
              </div>
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
            <div className="grid gap-3 sm:grid-cols-2">
              {checks.map(([name, label, direction]) => (
                <ScoreScale
                  defaultValue={3}
                  direction={direction}
                  key={name}
                  label={label}
                  name={name}
                  size="sm"
                />
              ))}
            </div>
            <Textarea name="notes" placeholder="Hinweis, Schmerzen, Anpassung" />
            <Button className="w-full" type="submit">
              Check-in speichern
            </Button>
          </ToastForm>
        )}
      </SideDrawer>
    </>
  );
}
