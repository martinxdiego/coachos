"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ChevronDown, ChevronUp, HeartPulse, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitPublicCheckin } from "@/app/actions-public";
import { ScoreScale } from "@/components/score-scale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate, todayIsoDate } from "@/lib/utils";

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

interface PublicCheckinCardProps {
  alreadyDone: boolean;
  todayCheckin: Record<string, unknown> | null;
}

export function PublicCheckinCard({
  alreadyDone,
  todayCheckin
}: PublicCheckinCardProps) {
  const t = useTranslations("checkin");
  const [expanded, setExpanded] = useState(!alreadyDone);
  const [isPending, startTransition] = useTransition();
  const today = todayIsoDate();

  function readScale(key: string) {
    const raw = todayCheckin?.[key];
    const value = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(value) ? value : 3;
  }

  function handle(formData: FormData) {
    startTransition(async () => {
      try {
        await submitPublicCheckin(formData);
        toast.success(t("toast_saved"));
        setExpanded(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : t("error_generic");
        toast.error(message);
      }
    });
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
        aria-controls="public-checkin-panel"
        aria-expanded={expanded}
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
              {t("today", { date: formatDate(today) })}
            </p>
            <p className="mt-0.5 text-[17px] font-semibold tracking-tight">
              {alreadyDone ? t("done") : t("prompt")}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {alreadyDone ? t("edit_hint") : t("duration")}
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
        <div
          className="border-t border-emerald-200/70 bg-white px-4 py-5"
          id="public-checkin-panel"
        >
          <form action={handle} className="space-y-4">
            <input name="checkin_date" type="hidden" value={today} />
            <input
              name="context_type"
              type="hidden"
              value={(todayCheckin?.context_type as string) ?? "training"}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {checks.map(([name, direction]) => (
                <ScoreScale
                  defaultValue={readScale(name)}
                  direction={direction}
                  key={name}
                  label={t(`scale.${name}`)}
                  name={name}
                />
              ))}
            </div>

            <div className="space-y-2">
              <label
                className="text-[12px] font-medium tracking-tight"
                htmlFor="public-checkin-notes"
              >
                {t("note_label")}
              </label>
              <Textarea
                defaultValue={(todayCheckin?.notes as string) ?? ""}
                id="public-checkin-notes"
                maxLength={2000}
                name="notes"
                placeholder={t("note_ph")}
              />
            </div>

            <Button
              className="h-12 w-full text-[15px]"
              disabled={isPending}
              type="submit"
            >
              {isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : alreadyDone ? (
                t("update")
              ) : (
                t("save")
              )}
            </Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
