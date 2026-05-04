"use client";

import { useState } from "react";
import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ListChecks,
  ScrollText,
  Shield,
  Trophy,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MaterialType } from "@/lib/types";

interface MaterialTypeOption {
  value: MaterialType;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const options: MaterialTypeOption[] = [
  {
    value: "exercise_sheet",
    label: "Übungsblatt",
    hint: "Ziel, Organisation, Ablauf, Coachingpunkte und Varianten.",
    icon: ScrollText
  },
  {
    value: "training_plan",
    label: "Trainingsplan",
    hint: "Füllt sich mit deinem letzten Training und den Phasen.",
    icon: ClipboardList
  },
  {
    value: "match_plan",
    label: "Matchplan",
    hint: "Füllt sich mit deinem nächsten Spiel.",
    icon: Trophy
  },
  {
    value: "tactics_sheet",
    label: "Taktikblatt",
    hint: "Enthält eine druckbare Taktiktafel.",
    icon: Shield
  },
  {
    value: "player_list",
    label: "Spielerliste",
    hint: "Übernimmt automatisch alle Spieler im Workspace.",
    icon: FileText
  },
  {
    value: "attendance_list",
    label: "Anwesenheitsliste",
    hint: "Übernimmt alle Spieler mit Checkboxen zum Abhaken.",
    icon: ClipboardCheck
  },
  {
    value: "week_plan",
    label: "Wochenplan",
    hint: "Sortiert Trainings und Spiele nach Datum.",
    icon: CalendarRange
  },
  {
    value: "month_plan",
    label: "Monatsplan",
    hint: "Sortiert deine kommenden Termine als Monatsübersicht.",
    icon: ListChecks
  }
];

export function MaterialTypePicker({
  defaultValue
}: {
  defaultValue?: MaterialType;
}) {
  const [active, setActive] = useState<MaterialType>(
    defaultValue ?? "training_plan"
  );
  const activeOption =
    options.find((option) => option.value === active) ?? options[0];

  return (
    <div className="space-y-3">
      <input name="type" type="hidden" value={active} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === active;
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 ease-spring active:scale-[0.98]",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:border-foreground/40"
              )}
              key={option.value}
              onClick={() => setActive(option.value)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  isActive
                    ? "bg-background/20 text-background"
                    : "bg-secondary text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[13px] font-semibold tracking-tight">
                  {option.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p
        className={cn(
          "rounded-xl border border-border/70 bg-secondary/60 px-3 py-2.5 text-[12.5px] leading-5 text-muted-foreground"
        )}
      >
        <strong className="text-foreground">{activeOption.label}:</strong>{" "}
        {activeOption.hint}
      </p>
    </div>
  );
}
