"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { ScoreScale } from "@/components/score-scale";
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
  { id: "player", labelKey: "mode_player", icon: UserPlus },
  { id: "training", labelKey: "mode_training", icon: CalendarPlus },
  { id: "match", labelKey: "mode_match", icon: Trophy },
  { id: "winner", labelKey: "mode_winner", icon: Medal },
  { id: "health", labelKey: "mode_health", icon: HeartPulse },
  { id: "task", labelKey: "mode_task", icon: ClipboardList }
] satisfies { id: QuickCreateMode; labelKey: string; icon: typeof Plus }[];

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
  const t = useTranslations("quickcreate");
  const tScale = useTranslations("checkin");
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<QuickCreateMode>("training");
  const today = todayIsoDate();

  if (!enabled) {
    return null;
  }

  return (
    <>
      <button
        aria-label={t("fab_label")}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_32px_rgba(16,185,129,0.32),0_2px_6px_rgba(15,23,42,0.18)] transition-transform duration-200 ease-spring hover:scale-105 active:scale-95 md:bottom-7 md:right-7"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Plus aria-hidden="true" className="h-6 w-6" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label={t("close_overlay")}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <section className="absolute bottom-0 right-0 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card/95 p-6 shadow-elevated backdrop-blur-xl animate-slide-up md:bottom-5 md:right-5 md:w-[460px] md:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                  {t("eyebrow")}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  {t("heading")}
                </h2>
              </div>
              <Button
                aria-label={t("close")}
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
                  label={t(item.labelKey)}
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
                  successMessage={t("player_saved")}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="qc-first-name">{t("first_name")}</Label>
                      <Input id="qc-first-name" name="first_name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qc-last-name">{t("last_name")}</Label>
                      <Input id="qc-last-name" name="last_name" required />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input name="position" placeholder={t("position_ph")} />
                    <Input name="birth_year" placeholder={t("birth_year_ph")} type="number" />
                    <Input name="jersey_number" placeholder={t("number_ph")} type="number" />
                  </div>
                  <Button className="w-full" type="submit">
                    {t("save_player")}
                  </Button>
                </ToastForm>
              ) : null}

              {mode === "training" ? (
                <ToastForm
                  action={createTraining}
                  className="space-y-4"
                  onComplete={() => setIsOpen(false)}
                  successMessage={t("training_created")}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input defaultValue={today} name="date" required type="date" />
                    <Input name="start_time" type="time" />
                  </div>
                  <Input
                    name="focus"
                    placeholder={t("focus_ph")}
                    required
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input defaultValue="90" name="duration_minutes" type="number" />
                    <Input name="location" placeholder={t("location_ph")} />
                  </div>
                  <Textarea name="goal" placeholder={t("goal_ph")} />
                  <Button className="w-full" type="submit">
                    {t("create_training")}
                  </Button>
                </ToastForm>
              ) : null}

              {mode === "match" ? (
                <ToastForm
                  action={createMatch}
                  className="space-y-4"
                  onComplete={() => setIsOpen(false)}
                  successMessage={t("match_planned")}
                >
                  <Input name="opponent" placeholder={t("opponent_ph")} required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input defaultValue={today} name="date" required type="date" />
                    <Input name="kickoff_time" type="time" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input name="location" placeholder={t("location_ph")} />
                    <Input name="meeting_point" placeholder={t("meeting_ph")} />
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
                    {t("plan_match")}
                  </Button>
                </ToastForm>
              ) : null}

              {mode === "winner" ? (
                players.length > 0 ? (
                  <ToastForm
                    action={addWinnerPoints}
                    className="space-y-4"
                    onComplete={() => setIsOpen(false)}
                    successMessage={t("winner_saved")}
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
                        <option value="training">{t("ctx_training")}</option>
                        <option value="match">{t("ctx_match")}</option>
                        <option value="event">{t("ctx_event")}</option>
                        <option value="monday_training">{t("ctx_monday")}</option>
                        <option value="other">{t("ctx_other")}</option>
                      </select>
                      <Input defaultValue={today} name="awarded_at" type="date" />
                    </div>
                    <Input
                      name="context_label"
                      placeholder={t("context_label_ph")}
                    />
                    <Textarea name="reason" placeholder={t("reason_ph")} />
                    <Button className="w-full" type="submit">
                      {t("save_winner")}
                    </Button>
                  </ToastForm>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {t("no_players_winner")}
                  </p>
                )
              ) : null}

              {mode === "health" ? (
                players.length > 0 ? (
                  <ToastForm
                    action={saveHealthCheckin}
                    className="space-y-4"
                    onComplete={() => setIsOpen(false)}
                    successMessage={t("checkin_saved")}
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
                      <option value="training">{t("chk_training")}</option>
                      <option value="match">{t("chk_match")}</option>
                      <option value="free">{t("chk_free")}</option>
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        ["wellbeing", "high-good"],
                        ["fatigue", "low-good"],
                        ["sleep_quality", "high-good"],
                        ["energy", "high-good"],
                        ["pain", "low-good"],
                        ["soreness", "low-good"],
                        ["stress", "low-good"],
                        ["motivation", "high-good"],
                        ["injury_feeling", "low-good"]
                      ] as const).map(([name, direction]) => (
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
                      {t("save_checkin")}
                    </Button>
                  </ToastForm>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {t("no_players_checkin")}
                  </p>
                )
              ) : null}

              {mode === "task" ? (
                <ToastForm
                  action={createTask}
                  className="space-y-4"
                  onComplete={() => setIsOpen(false)}
                  successMessage={t("task_created")}
                >
                  <Input name="title" placeholder={t("task_ph")} required />
                  <Input name="due_date" type="date" />
                  <Button className="w-full" type="submit">
                    {t("create_task")}
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
