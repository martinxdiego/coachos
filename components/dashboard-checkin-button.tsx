"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

const checks: ReadonlyArray<readonly [string, Direction]> = [
  ["wellbeing", "high-good"],
  ["fatigue", "low-good"],
  ["sleep_quality", "high-good"],
  ["energy", "high-good"],
  ["pain", "low-good"],
  ["soreness", "low-good"],
  ["stress", "low-good"],
  ["motivation", "high-good"],
  ["injury_feeling", "low-good"]
];

export function DashboardCheckinButton({
  players
}: {
  players: CheckPlayer[];
}) {
  const t = useTranslations("wellness");
  const tScale = useTranslations("checkin");
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
              {t("start_title")}
            </span>
            <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
              {t("start_subtitle")}
            </span>
          </span>
        </span>
      </button>

      <SideDrawer
        description={t("drawer_desc")}
        eyebrow={t("drawer_eyebrow")}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t("drawer_title")}
      >
        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("no_players")}
          </p>
        ) : (
          <ToastForm
            action={saveHealthCheckin}
            className="space-y-4"
            onComplete={() => { triggerConfetti({ x: 0.5, y: 0.4 }); setTimeout(() => setIsOpen(false), 80); }}
            successMessage={t("success")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dash-checkin-player">{t("player_label")}</Label>
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
                <Label htmlFor="dash-checkin-date">{t("date_label")}</Label>
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
              <option value="training">{t("ctx_training")}</option>
              <option value="match">{t("ctx_match")}</option>
              <option value="free">{t("ctx_free")}</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              {checks.map(([name, direction]) => (
                <ScoreScale
                  defaultValue={3}
                  direction={direction}
                  key={name}
                  label={tScale(`scale.${name}`)}
                  name={name}
                  size="sm"
                />
              ))}
            </div>
            <Textarea name="notes" placeholder={t("notes_ph")} />
            <Button className="w-full" type="submit">
              {t("save")}
            </Button>
          </ToastForm>
        )}
      </SideDrawer>
    </>
  );
}
