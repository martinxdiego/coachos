"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { submitPublicSeasonForm } from "@/app/actions-public";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface PublicSeasonFormPlayer {
  contact: string | null;
  parent_contact: string | null;
  emergency_contact: string | null;
  strong_foot: string | null;
  favorite_team: string | null;
  favorite_player: string | null;
  football_goals: string | null;
  strengths: string | null;
  weaknesses: string | null;
  motivation: string | null;
  season_form_completed_at: string | null;
}

interface PublicSeasonFormProps {
  player: PublicSeasonFormPlayer;
}

export function PublicSeasonForm({ player }: PublicSeasonFormProps) {
  const t = useTranslations("season");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const filled = Boolean(player.season_form_completed_at);

  function handle(formData: FormData) {
    startTransition(async () => {
      try {
        await submitPublicSeasonForm(formData);
        toast.success(t("toast_saved"));
        setOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : t("error_generic");
        toast.error(message);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <button
        className="flex w-full items-center justify-between gap-3 p-4"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground"
          >
            <UserRound className="h-5 w-5" />
          </span>
          <div className="text-left">
            <p className="text-[15px] font-semibold tracking-tight">
              {t("title")}
              {filled ? (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  {t("filled_badge")}
                </span>
              ) : null}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-border p-4 sm:p-5">
          <form action={handle} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                defaultValue={player.contact ?? ""}
                maxLength={250}
                name="contact"
                placeholder={t("contact_ph")}
              />
              <Input
                defaultValue={player.parent_contact ?? ""}
                maxLength={250}
                name="parent_contact"
                placeholder={t("parent_ph")}
              />
              <Input
                defaultValue={player.emergency_contact ?? ""}
                maxLength={250}
                name="emergency_contact"
                placeholder={t("emergency_ph")}
              />
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={player.strong_foot ?? ""}
                name="strong_foot"
              >
                <option value="">{t("foot_open")}</option>
                <option value="left">{t("foot_left")}</option>
                <option value="right">{t("foot_right")}</option>
                <option value="both">{t("foot_both")}</option>
              </select>
              <Input
                defaultValue={player.favorite_team ?? ""}
                maxLength={120}
                name="favorite_team"
                placeholder={t("favteam_ph")}
              />
              <Input
                defaultValue={player.favorite_player ?? ""}
                maxLength={120}
                name="favorite_player"
                placeholder={t("favplayer_ph")}
              />
            </div>
            <Textarea
              defaultValue={player.football_goals ?? ""}
              maxLength={2000}
              name="football_goals"
              placeholder={t("goals_ph")}
            />
            <Textarea
              defaultValue={player.strengths ?? ""}
              maxLength={2000}
              name="strengths"
              placeholder={t("strengths_ph")}
            />
            <Textarea
              defaultValue={player.weaknesses ?? ""}
              maxLength={2000}
              name="weaknesses"
              placeholder={t("weaknesses_ph")}
            />
            <Textarea
              defaultValue={player.motivation ?? ""}
              maxLength={2000}
              name="motivation"
              placeholder={t("motivation_ph")}
            />
            <Button className="h-11 w-full" disabled={isPending} type="submit">
              {isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
