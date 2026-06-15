import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Rocket,
  UsersRound,
  type LucideIcon
} from "lucide-react";

interface FirstRunChecklistProps {
  hasBasics: boolean;
  hasPlayers: boolean;
  hasTraining: boolean;
}

interface ChecklistStep {
  key: string;
  href: string;
  icon: LucideIcon;
  done: boolean;
}

/**
 * S6.3: Datengetriebener Erste-Schritte-Pfad für neue Trainer. Wird auf dem
 * Dashboard angezeigt, solange noch kein Training existiert, und führt ohne
 * Doku zum Ziel „erstes Training geplant". Jeder Schritt zeigt seinen echten
 * Status (aus den Workspace-Daten) und eine direkte Aktion.
 */
export async function FirstRunChecklist({
  hasBasics,
  hasPlayers,
  hasTraining
}: FirstRunChecklistProps) {
  const t = await getTranslations("firstrun");

  const steps: ChecklistStep[] = [
    { key: "basics", href: "/workspaces", icon: Building2, done: hasBasics },
    { key: "players", href: "/players", icon: UsersRound, done: hasPlayers },
    { key: "training", href: "/trainings", icon: CalendarPlus, done: hasTraining }
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-300/60 bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-white p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"
        >
          <Rocket className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-emerald-950">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-[13px] text-emerald-900/70">
            {t("subtitle")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-600/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-800">
          {t("progress", { done: doneCount, total: steps.length })}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-600/15">
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              className="group flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-white/80 px-3.5 py-3 transition hover:border-emerald-400 hover:bg-white"
              href={step.href}
            >
              {step.done ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-emerald-600"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-emerald-300"
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={
                    step.done
                      ? "text-[14px] font-medium text-muted-foreground line-through"
                      : "text-[14px] font-semibold tracking-tight text-foreground"
                  }
                >
                  {t(`${step.key}_title`)}
                </p>
                {!step.done ? (
                  <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                    {t(`${step.key}_body`)}
                  </p>
                ) : null}
              </div>
              {!step.done ? (
                <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-emerald-700">
                  {t(`${step.key}_cta`)}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="shrink-0 text-[12px] font-medium text-emerald-600">
                  {t("done_label")}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
