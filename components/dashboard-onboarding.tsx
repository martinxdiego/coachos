"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Compass,
  HeartPulse,
  Sparkles,
  Trophy,
  X,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "coachos.onboarding.dismissed.v1";

interface Step {
  icon: LucideIcon;
  key: string;
  ctaHref: string;
  accent: string;
}

const steps: Step[] = [
  {
    icon: Compass,
    key: "step1",
    ctaHref: "/",
    accent: "from-emerald-500/15 to-emerald-500/0 text-emerald-700"
  },
  {
    icon: CalendarPlus,
    key: "step2",
    ctaHref: "/trainings",
    accent: "from-sky-500/15 to-sky-500/0 text-sky-700"
  },
  {
    icon: HeartPulse,
    key: "step3",
    ctaHref: "/health",
    accent: "from-red-500/15 to-red-500/0 text-red-700"
  },
  {
    icon: Trophy,
    key: "step4",
    ctaHref: "/matches",
    accent: "from-amber-500/15 to-amber-500/0 text-amber-700"
  }
];

export function DashboardOnboarding() {
  const t = useTranslations("onboarding");
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore quota issues — best-effort persistence
    }
  }

  function reopen() {
    setStep(0);
    setVisible(true);
  }

  if (!visible) {
    return (
      <div className="flex justify-end">
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
          onClick={reopen}
          type="button"
        >
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          {t("open_tour")}
        </button>
      </div>
    );
  }

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <section
      aria-label={t("aria_section")}
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 -z-0 bg-gradient-to-br opacity-50",
          current.accent
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/80 text-foreground shadow-sm ring-1 ring-border/60"
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                {t(`${current.key}_eyebrow`)}
              </p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
                {t(`${current.key}_title`)}
              </h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-6 text-muted-foreground">
                {t(`${current.key}_body`)}
              </p>
            </div>
          </div>
          <button
            aria-label={t("close_tour")}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            onClick={dismiss}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div aria-label={t("progress")} className="flex gap-1.5">
            {steps.map((stepItem, index) => {
              const reached = index <= step;
              return (
                <button
                  aria-label={t("step_aria", {
                    n: index + 1,
                    title: t(`${stepItem.key}_title`)
                  })}
                  className={cn(
                    "h-1.5 w-8 rounded-full transition",
                    reached ? "bg-foreground" : "bg-secondary"
                  )}
                  key={stepItem.key}
                  onClick={() => setStep(index)}
                  type="button"
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {step > 0 ? (
              <Button
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t("back")}
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href={current.ctaHref}>{t(`${current.key}_cta`)}</Link>
            </Button>
            {isLast ? (
              <Button onClick={dismiss} size="sm" type="button">
                {t("finish")}
              </Button>
            ) : (
              <Button
                onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                size="sm"
                type="button"
              >
                {t("next")}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
