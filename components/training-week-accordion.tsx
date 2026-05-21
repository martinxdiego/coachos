"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Pencil,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteTraining,
  deleteTrainingWeek,
  duplicateTraining,
  reorderPhase,
  saveAttendance,
  savePlayerEvaluation,
  updateTraining,
  updateTrainingPhase
} from "@/app/actions";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { PhaseMediaMenu } from "@/components/phase-media-menu";
import { TrainingPhaseDiagram } from "@/components/training-phase-diagram";
import { ToastForm } from "@/components/toast-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import type { AttendanceStatus, TrainingIntensity, TrainingPhase, TrainingPhaseType } from "@/lib/types";

type TrainingListItem = {
  age_group: string | null;
  date: string;
  duration_minutes: number | null;
  focus: string;
  goal: string | null;
  id: string;
  intensity: TrainingIntensity | null;
  is_template: boolean;
  location: string | null;
  notes: string | null;
  participants: string | null;
  start_time: string | null;
};

type AttendanceRow = {
  player_id: string;
  status: AttendanceStatus;
  training_id: string;
};

type PlayerRow = {
  id: string;
  name: string;
  position: string | null;
};

type WeekGroup = {
  end: Date;
  key: string;
  label: string;
  start: Date;
  trainings: TrainingListItem[];
};

const weekdayFormatter = new Intl.DateTimeFormat("de-CH", {
  weekday: "long"
});

const shortDateFormatter = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit"
});

const phaseLabels: Record<TrainingPhaseType, string> = {
  cooldown: "Cooldown",
  finish: "Abschluss",
  game_form: "Spielform",
  tactics: "Taktik",
  technique: "Technik",
  warmup: "Warm-up"
};

const phaseOrder: TrainingPhaseType[] = [
  "warmup",
  "technique",
  "tactics",
  "game_form",
  "finish",
  "cooldown"
];

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function startOfIsoWeek(date: Date) {
  const next = new Date(date);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoWeekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function weekKey(date: Date) {
  const start = startOfIsoWeek(date);
  return start.toISOString().slice(0, 10);
}

function groupTrainingsByWeek(trainings: TrainingListItem[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();

  for (const training of trainings) {
    const date = parseDate(training.date);
    const start = startOfIsoWeek(date);
    const key = weekKey(date);
    const group =
      groups.get(key) ??
      ({
        end: addDays(start, 6),
        key,
        label: `Woche ${isoWeekNumber(date)}`,
        start,
        trainings: []
      } satisfies WeekGroup);

    group.trainings.push(training);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      trainings: group.trainings.sort((a, b) =>
        `${a.date}${a.start_time ?? ""}`.localeCompare(`${b.date}${b.start_time ?? ""}`)
      )
    }))
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

function trainingTimeStatus(dateIso: string): "today" | "upcoming" | "past" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const trainingDate = parseDate(dateIso);
  if (trainingDate.getTime() === today.getTime()) return "today";
  if (trainingDate.getTime() > today.getTime()) return "upcoming";
  return "past";
}

function intensityLabel(intensity: TrainingIntensity | null | undefined): string | null {
  if (!intensity) return null;
  switch (intensity) {
    case "low":
      return "Leicht";
    case "medium":
      return "Mittel";
    case "high":
      return "Intensiv";
    default:
      return intensity;
  }
}

function durationLabel(training: TrainingListItem, phases: TrainingPhase[]) {
  const phaseMinutes = phases.reduce(
    (sum, phase) => sum + (phase.duration_minutes ?? 0),
    0
  );
  const minutes = training.duration_minutes ?? phaseMinutes;
  return minutes ? `${minutes} Min.` : "Dauer offen";
}

function materialSummary(phases: TrainingPhase[]) {
  const materials = phases
    .map((phase) => phase.material)
    .filter((item): item is string => Boolean(item));

  return materials.length > 0 ? [...new Set(materials)].join(", ") : "Kein Material erfasst";
}

export function TrainingWeekAccordion({
  attendanceRows,
  phases,
  players,
  trainings
}: {
  attendanceRows: AttendanceRow[];
  phases: TrainingPhase[];
  players: PlayerRow[];
  trainings: TrainingListItem[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [visibleTrainings, setVisibleTrainings] = useState(trainings);
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const [openTrainings, setOpenTrainings] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editingPhaseIds, setEditingPhaseIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [deletingWeeks, setDeletingWeeks] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [intensityFilter, setIntensityFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setVisibleTrainings(trainings);
  }, [trainings]);

  const phasesByTraining = useMemo(() => {
    const map = new Map<string, TrainingPhase[]>();
    for (const phase of phases) {
      map.set(phase.training_id, [...(map.get(phase.training_id) ?? []), phase]);
    }
    return map;
  }, [phases]);

  const attendanceByTraining = useMemo(() => {
    const map = new Map<string, Map<string, AttendanceStatus>>();
    for (const row of attendanceRows) {
      const trainingMap = map.get(row.training_id) ?? new Map<string, AttendanceStatus>();
      trainingMap.set(row.player_id, row.status);
      map.set(row.training_id, trainingMap);
    }
    return map;
  }, [attendanceRows]);

  const filteredTrainings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return visibleTrainings.filter((training) => {
      const haystack = [
        training.focus,
        training.date,
        training.goal,
        training.notes,
        training.age_group,
        training.intensity
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (intensityFilter === "all" ||
          training.intensity === intensityFilter) &&
        (teamFilter === "all" || training.age_group === teamFilter)
      );
    });
  }, [intensityFilter, query, teamFilter, visibleTrainings]);

  const teamOptions = useMemo(
    () => [
      ...new Set(
        visibleTrainings
          .map((training) => training.age_group)
          .filter((value): value is string => Boolean(value))
      )
    ],
    [visibleTrainings]
  );

  const weekGroups = useMemo(
    () => groupTrainingsByWeek(filteredTrainings),
    [filteredTrainings]
  );

  function toggleWeek(key: string) {
    setOpenWeeks((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleTraining(id: string) {
    setOpenTrainings((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleEditing(id: string) {
    setEditingIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleEditingPhase(id: string) {
    setEditingPhaseIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDeleteWeek(week: WeekGroup) {
    if (deletingWeeks.has(week.key)) return;
    const confirmed = await confirm({
      title: `${week.label} löschen?`,
      description: `Alle ${week.trainings.length} Trainings dieser Woche werden unwiderruflich gelöscht.`,
      confirmLabel: "Woche löschen",
      cancelLabel: "Abbrechen",
      destructive: true,
    });
    if (!confirmed) return;
    setDeletingWeeks((prev) => new Set(prev).add(week.key));
    startTransition(async () => {
      try {
        const formData = new FormData();
        for (const t of week.trainings) formData.append("training_id", t.id);
        await deleteTrainingWeek(formData);
        setVisibleTrainings((prev) => prev.filter((t) => !week.trainings.some((w) => w.id === t.id)));
        toast.success(`${week.trainings.length} Trainings gelöscht`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Löschen");
      }
      setDeletingWeeks((prev) => { const next = new Set(prev); next.delete(week.key); return next; });
    });
  }

  async function handleDelete(training: TrainingListItem) {
    if (deletingIds.has(training.id)) {
      return;
    }

    const confirmed = await confirm({
      title: "Training wirklich löschen?",
      description: `"${training.focus}" am ${formatDate(training.date)} wird unwiderruflich entfernt.`,
      confirmLabel: "Löschen",
      cancelLabel: "Abbrechen",
      destructive: true
    });

    if (!confirmed) {
      return;
    }

    const previousTrainings = visibleTrainings;
    setDeletingIds((current) => new Set(current).add(training.id));
    setRemovingIds((current) => new Set(current).add(training.id));

    // Warte auf Slide-Out-Animation, dann DOM-Eintrag entfernen
    await new Promise((resolve) => setTimeout(resolve, 380));
    setVisibleTrainings((current) =>
      current.filter((item) => item.id !== training.id)
    );
    setOpenTrainings((current) => {
      const next = new Set(current);
      next.delete(training.id);
      return next;
    });

    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", training.id);

      try {
        await deleteTraining(formData);
        toast.success("Training gelöscht");
        router.refresh();
      } catch (deleteError) {
        setVisibleTrainings(previousTrainings);
        setRemovingIds((current) => {
          const next = new Set(current);
          next.delete(training.id);
          return next;
        });
        toast.error(
          deleteError instanceof Error
            ? deleteError.message
            : "Training konnte nicht gelöscht werden."
        );
      } finally {
        setDeletingIds((current) => {
          const next = new Set(current);
          next.delete(training.id);
          return next;
        });
      }
    });
  }

  function handleDuplicate(trainingId: string) {
    const formData = new FormData();
    formData.set("id", trainingId);
    startTransition(async () => {
      try {
        await duplicateTraining(formData);
        toast.success("Training dupliziert");
        router.refresh();
      } catch (duplicateError) {
        toast.error(
          duplicateError instanceof Error
            ? duplicateError.message
            : "Training konnte nicht dupliziert werden."
        );
      }
    });
  }

  if (visibleTrainings.length === 0) {
    return (
      <Card>
        <CardContent className="p-2">
          <EmptyState
            body="Erstelle oben rechts dein erstes Training, eine Vorlage oder einen KI-Entwurf."
            icon={ClipboardList}
            title="Noch keine Trainings geplant."
          />
        </CardContent>
      </Card>
    );
  }

  const intensityChips: { id: string; label: string }[] = [
    { id: "all", label: "Alle" },
    { id: "low", label: "Niedrig" },
    { id: "medium", label: "Mittel" },
    { id: "high", label: "Hoch" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-10"
            id="training-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Thema, Ziel, Notiz…"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Suche leeren"
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setQuery("")}
              type="button"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {intensityChips.map((chip) => {
            const isActive = chip.id === intensityFilter;
            return (
              <button
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium tracking-tight transition-colors duration-150 active:scale-95",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground/80 hover:border-foreground/40"
                )}
                key={chip.id}
                onClick={() => setIntensityFilter(chip.id)}
                type="button"
              >
                {chip.label}
              </button>
            );
          })}

          {teamOptions.length > 0 ? (
            <div className="relative">
              <select
                aria-label="Team / Kategorie"
                className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-card pl-3.5 pr-9 text-[13px] font-medium tracking-tight text-foreground/80 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setTeamFilter(event.target.value)}
                value={teamFilter}
              >
                <option value="all">Alle Teams</option>
                {teamOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronsUpDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          ) : null}
        </div>
      </div>

      {weekGroups.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-[15px] font-semibold tracking-tight">
              Keine Trainings im Filter.
            </p>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              Passe Suche, Team oder Intensität an.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {weekGroups.map((week) => {
        const isWeekOpen = openWeeks.has(week.key);
        const weekMinutes = week.trainings.reduce((sum, training) => {
          const trainingPhases = phasesByTraining.get(training.id) ?? [];
          const phaseMinutes = trainingPhases.reduce(
            (phaseSum, phase) => phaseSum + (phase.duration_minutes ?? 0),
            0
          );
          return sum + (training.duration_minutes ?? phaseMinutes);
        }, 0);

        const isDeletingWeek = deletingWeeks.has(week.key);

        return (
          <section
            className={cn(
              "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft transition-opacity duration-200",
              isDeletingWeek && "opacity-50"
            )}
            key={week.key}
          >
            <div className="flex items-stretch">
            <button
              className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-4 text-left transition hover:bg-secondary/60 sm:flex-row sm:items-center sm:justify-between"
              onClick={() => toggleWeek(week.key)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                  {isWeekOpen ? (
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {week.label} · {week.trainings.length} Trainings
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {shortDateFormatter.format(week.start)} bis{" "}
                    {shortDateFormatter.format(week.end)}
                  </span>
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                <Badge variant="secondary">{weekMinutes || 0} Min.</Badge>
                <Badge variant="secondary">
                  {week.trainings.filter((item) => item.intensity === "high").length} intensiv
                </Badge>
              </span>
            </button>
            <button
              className="no-print flex items-center border-l border-border/60 px-3 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
              disabled={isDeletingWeek}
              onClick={(e) => { e.stopPropagation(); handleDeleteWeek(week); }}
              title="Woche löschen"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            </div>

            <div
              className={cn(
                "grid transition-all duration-300 ease-out",
                isWeekOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <div className="space-y-2 border-t border-border bg-background/40 p-3">
                  {week.trainings.map((training) => {
                    const trainingPhases = phasesByTraining.get(training.id) ?? [];
                    const attendance =
                      attendanceByTraining.get(training.id) ??
                      new Map<string, AttendanceStatus>();
                    const presentCount = players.filter(
                      (player) => attendance.get(player.id) === "present"
                    ).length;
                    const isTrainingOpen = openTrainings.has(training.id);
                    const isEditing = editingIds.has(training.id);
                    const isDeleting = deletingIds.has(training.id);
                    const isRemoving = removingIds.has(training.id);
                    const phasesByType = new Map(
                      trainingPhases.map((phase) => [phase.phase_type, phase])
                    );

                    return (
                      <div
                        key={`wrap-${training.id}`}
                        style={{
                          display: "grid",
                          gridTemplateRows: isRemoving ? "0fr" : "1fr",
                          opacity: isRemoving ? 0 : 1,
                          transition: "grid-template-rows .38s cubic-bezier(.4,0,.2,1), opacity .22s ease-out",
                          overflow: "hidden",
                        }}
                      >
                      <div style={{ overflow: "hidden", minHeight: 0 }}>
                      <article
                        className={cn(
                          "rounded-2xl border border-border/70 bg-card transition-opacity duration-200",
                          isDeleting && "opacity-50"
                        )}
                        key={training.id}
                      >
                        <button
                          className="flex w-full flex-col gap-3 px-3 py-3 text-left transition hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between"
                          onClick={() => toggleTraining(training.id)}
                          type="button"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                              {isTrainingOpen ? (
                                <ChevronDown aria-hidden="true" className="h-4 w-4" />
                              ) : (
                                <ChevronRight aria-hidden="true" className="h-4 w-4" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {weekdayFormatter.format(parseDate(training.date))} ·{" "}
                                {training.focus}
                              </span>
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {training.start_time
                                  ? `${training.start_time.slice(0, 5)} · `
                                  : ""}
                                {durationLabel(training, trainingPhases)}
                                {training.location ? ` · ${training.location}` : ""}
                              </span>
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-2">
                            {(() => {
                              const status = trainingTimeStatus(training.date);
                              if (status === "today") {
                                return (
                                  <Badge variant="success">Heute</Badge>
                                );
                              }
                              if (status === "upcoming") {
                                return (
                                  <Badge
                                    className="border-sky-200/70 bg-sky-50 text-sky-900"
                                    variant="secondary"
                                  >
                                    Geplant
                                  </Badge>
                                );
                              }
                              return (
                                <Badge variant="secondary">Vergangen</Badge>
                              );
                            })()}
                            {training.intensity ? (
                              <Badge
                                className={
                                  training.intensity === "high"
                                    ? "border-red-200/70 bg-red-50 text-red-900"
                                    : training.intensity === "medium"
                                    ? "border-amber-200/70 bg-amber-50 text-amber-900"
                                    : "border-emerald-200/70 bg-emerald-50 text-emerald-900"
                                }
                                variant="secondary"
                              >
                                {intensityLabel(training.intensity)}
                              </Badge>
                            ) : null}
                            <Badge variant="secondary">
                              {trainingPhases.length}{" "}
                              {trainingPhases.length === 1 ? "Phase" : "Phasen"}
                            </Badge>
                          </span>
                        </button>

                        <div
                          className={cn(
                            "grid transition-all duration-300 ease-out",
                            isTrainingOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          )}
                        >
                          <div className="overflow-hidden">
                            <div
                              className="space-y-4 border-t border-border p-4"
                              style={{
                                opacity: isTrainingOpen ? 1 : 0,
                                transition: "opacity 0.22s ease-out 0.14s",
                              }}
                            >
                              {/* Sticky action bar */}
                              <div className="no-print sticky top-0 z-10 -mx-4 -mt-4 mb-2 flex items-center justify-between border-b border-border/60 bg-card/95 px-4 py-2 backdrop-blur-sm">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {training.focus}
                                </span>
                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <>
                                      <Button
                                        form={`edit-training-${training.id}`}
                                        size="sm"
                                        type="submit"
                                        variant="default"
                                      >
                                        <Save aria-hidden="true" className="h-3.5 w-3.5" />
                                        Speichern
                                      </Button>
                                      <Button
                                        onClick={() => toggleEditing(training.id)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                                        Abbrechen
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <PdfDownloadButton
                                        className="h-8 text-xs"
                                        href={`/api/pdf/training/${training.id}`}
                                        label="PDF"
                                        variant="outline"
                                      />
                                      <Button
                                        disabled={isDeleting}
                                        onClick={() => toggleEditing(training.id)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                                        Bearbeiten
                                      </Button>
                                      <Button
                                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                        disabled={isDeleting}
                                        onClick={() => handleDelete(training)}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                      >
                                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="grid gap-3 md:grid-cols-4">
                                <div className="rounded-lg bg-secondary px-3 py-2">
                                  <p className="text-xs text-muted-foreground">Dauer</p>
                                  <p className="font-semibold">
                                    {durationLabel(training, trainingPhases)}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-secondary px-3 py-2">
                                  <p className="text-xs text-muted-foreground">Anwesend</p>
                                  <p className="font-semibold">
                                    {presentCount}/{players.length}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-secondary px-3 py-2">
                                  <p className="text-xs text-muted-foreground">Material</p>
                                  <p className="line-clamp-1 font-semibold">
                                    {materialSummary(trainingPhases)}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-secondary px-3 py-2">
                                  <p className="text-xs text-muted-foreground">Altersstufe</p>
                                  <p className="font-semibold">
                                    {training.age_group ?? "Offen"}
                                  </p>
                                </div>
                              </div>

                              {training.goal ? (
                                <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                                  {training.goal}
                                </p>
                              ) : null}

                              <div className="grid gap-2">
                                {trainingPhases.length > 0 ? (
                                  trainingPhases.map((phase, index) => (
                                    <div
                                      className="grid gap-2 rounded-lg border border-border bg-background/70 p-3 sm:grid-cols-[32px_1fr_auto]"
                                      key={phase.id}
                                    >
                                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                                        {index + 1}
                                      </span>
                                      <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant="secondary">
                                            {phaseLabels[phase.phase_type]}
                                          </Badge>
                                          <p className="truncate font-semibold">
                                            {phase.title}
                                          </p>
                                        </div>
                                        {phase.description ? (
                                          <p className="text-sm leading-6 text-muted-foreground">
                                            {phase.description}
                                          </p>
                                        ) : null}
                                        {phase.diagram ? (
                                          <TrainingPhaseDiagram
                                            diagram={phase.diagram}
                                            className="mt-2 max-w-sm"
                                          />
                                        ) : null}
                                        <div className="no-print pt-1">
                                          <PhaseMediaMenu
                                            images={phase.image_urls ?? []}
                                            phaseId={phase.id}
                                            phaseTitle={phase.title}
                                          />
                                        </div>
                                        {/* Inline phase edit form */}
                                        <div
                                          className={cn(
                                            "no-print grid transition-all duration-200 ease-out",
                                            editingPhaseIds.has(phase.id)
                                              ? "grid-rows-[1fr]"
                                              : "grid-rows-[0fr]"
                                          )}
                                        >
                                          <div className="overflow-hidden">
                                            <ToastForm
                                              action={updateTrainingPhase}
                                              className="mt-3 space-y-3 rounded-xl border border-border/70 bg-secondary/30 p-3"
                                              onComplete={() => toggleEditingPhase(phase.id)}
                                              successMessage="Phase gespeichert"
                                            >
                                              <input name="phase_id" type="hidden" defaultValue={phase.id} />
                                              <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1">
                                                  <Label htmlFor={`${phase.id}-title`}>Titel</Label>
                                                  <Input
                                                    defaultValue={phase.title}
                                                    id={`${phase.id}-title`}
                                                    name="title"
                                                    required
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <Label htmlFor={`${phase.id}-duration`}>Dauer (Min.)</Label>
                                                  <Input
                                                    defaultValue={phase.duration_minutes ?? ""}
                                                    id={`${phase.id}-duration`}
                                                    min={1}
                                                    name="duration_minutes"
                                                    type="number"
                                                  />
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                <Label htmlFor={`${phase.id}-description`}>Beschreibung</Label>
                                                <Textarea
                                                  defaultValue={phase.description ?? ""}
                                                  id={`${phase.id}-description`}
                                                  name="description"
                                                  rows={2}
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label htmlFor={`${phase.id}-coaching`}>Coachingpunkte</Label>
                                                <Textarea
                                                  defaultValue={phase.coaching_points ?? ""}
                                                  id={`${phase.id}-coaching`}
                                                  name="coaching_points"
                                                  rows={2}
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label htmlFor={`${phase.id}-org`}>Organisation</Label>
                                                <Textarea
                                                  defaultValue={phase.organization ?? ""}
                                                  id={`${phase.id}-org`}
                                                  name="organization"
                                                  rows={2}
                                                />
                                              </div>
                                              <div className="grid gap-3 sm:grid-cols-3">
                                                <div className="space-y-1">
                                                  <Label htmlFor={`${phase.id}-material`}>Material</Label>
                                                  <Input
                                                    defaultValue={phase.material ?? ""}
                                                    id={`${phase.id}-material`}
                                                    name="material"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <Label htmlFor={`${phase.id}-players`}>Spieleranzahl</Label>
                                                  <Input
                                                    defaultValue={phase.player_count ?? ""}
                                                    id={`${phase.id}-players`}
                                                    name="player_count"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <Label htmlFor={`${phase.id}-field`}>Feldgrösse</Label>
                                                  <Input
                                                    defaultValue={phase.field_size ?? ""}
                                                    id={`${phase.id}-field`}
                                                    name="field_size"
                                                  />
                                                </div>
                                              </div>
                                              <div className="space-y-1">
                                                <Label htmlFor={`${phase.id}-variations`}>Varianten</Label>
                                                <Textarea
                                                  defaultValue={phase.variations ?? ""}
                                                  id={`${phase.id}-variations`}
                                                  name="variations"
                                                  rows={2}
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label htmlFor={`${phase.id}-load`}>Belastungssteuerung</Label>
                                                <Textarea
                                                  defaultValue={phase.load_management ?? ""}
                                                  id={`${phase.id}-load`}
                                                  name="load_management"
                                                  rows={2}
                                                />
                                              </div>
                                              <div className="flex gap-2 justify-end">
                                                <Button
                                                  onClick={() => toggleEditingPhase(phase.id)}
                                                  size="sm"
                                                  type="button"
                                                  variant="outline"
                                                >
                                                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                                                  Abbrechen
                                                </Button>
                                                <Button size="sm" type="submit">
                                                  <Save aria-hidden="true" className="h-3.5 w-3.5" />
                                                  Speichern
                                                </Button>
                                              </div>
                                            </ToastForm>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-2 sm:self-start">
                                        <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold">
                                          {phase.duration_minutes ?? 0} Min.
                                        </span>
                                        <div className="no-print flex items-center gap-1">
                                          {/* Reorder buttons */}
                                          <div className="flex flex-col gap-0.5 no-print">
                                            <button
                                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                                              disabled={index === 0}
                                              onClick={() => {
                                                const fd = new FormData();
                                                fd.set("phase_id", phase.id);
                                                fd.set("direction", "up");
                                                startTransition(() => { void reorderPhase(fd).then(() => router.refresh()).catch(() => { toast.error("Fehler beim Verschieben"); }); });
                                              }}
                                              title="Phase nach oben"
                                              type="button"
                                            >
                                              <ChevronUp className="h-3 w-3" />
                                            </button>
                                            <button
                                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                                              disabled={index === trainingPhases.length - 1}
                                              onClick={() => {
                                                const fd = new FormData();
                                                fd.set("phase_id", phase.id);
                                                fd.set("direction", "down");
                                                startTransition(() => { void reorderPhase(fd).then(() => router.refresh()).catch(() => { toast.error("Fehler beim Verschieben"); }); });
                                              }}
                                              title="Phase nach unten"
                                              type="button"
                                            >
                                              <ChevronDown className="h-3 w-3" />
                                            </button>
                                          </div>
                                          <Button
                                            className="no-print h-7 w-7 p-0"
                                            onClick={() => toggleEditingPhase(phase.id)}
                                            size="sm"
                                            title="Phase bearbeiten"
                                            type="button"
                                            variant={editingPhaseIds.has(phase.id) ? "default" : "outline"}
                                          >
                                            <Pencil aria-hidden="true" className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                                    Keine Übungen oder Phasen erfasst.
                                  </p>
                                )}
                              </div>

                              {training.notes ? (
                                <p className="rounded-xl border border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                                  {training.notes}
                                </p>
                              ) : null}

                              {players.length > 0 ? (
                                <details className="rounded-2xl border border-border/70 bg-secondary/30 p-4 no-print">
                                  <summary className="cursor-pointer text-[14px] font-semibold tracking-tight">
                                    Anwesenheit erfassen ({presentCount}/{players.length})
                                  </summary>
                                  <ToastForm
                                    action={saveAttendance}
                                    className="mt-4 space-y-3"
                                    successMessage="Anwesenheit gespeichert"
                                  >
                                    <input
                                      name="training_id"
                                      type="hidden"
                                      defaultValue={training.id}
                                    />
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                      {players.map((player) => {
                                        const status = attendance.get(player.id);
                                        return (
                                          <label
                                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-3 text-sm"
                                            key={player.id}
                                          >
                                            <input
                                              name="player_id"
                                              type="hidden"
                                              defaultValue={player.id}
                                            />
                                            <span className="min-w-0">
                                              <span className="block truncate font-medium">
                                                {player.name}
                                              </span>
                                              {player.position ? (
                                                <span className="text-xs text-muted-foreground">
                                                  {player.position}
                                                </span>
                                              ) : null}
                                            </span>
                                            <input
                                              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                                              defaultChecked={status === "present"}
                                              name="present_player_id"
                                              type="checkbox"
                                              value={player.id}
                                            />
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <Button type="submit" variant="secondary">
                                      Anwesenheit speichern
                                    </Button>
                                  </ToastForm>
                                </details>
                              ) : null}

                              {players.length > 0 ? (
                                <details className="rounded-2xl border border-border/70 bg-secondary/30 p-4 no-print">
                                  <summary className="cursor-pointer text-[14px] font-semibold tracking-tight">
                                    Spielerbewertung erfassen
                                  </summary>
                                  <ToastForm
                                    action={savePlayerEvaluation}
                                    className="mt-4 grid gap-3 md:grid-cols-6"
                                    successMessage="Bewertung gespeichert"
                                  >
                                    <input name="context_type" type="hidden" value="training" />
                                    <input name="context_id" type="hidden" value={training.id} />
                                    <input name="context_label" type="hidden" value={training.focus} />
                                    <input name="evaluation_date" type="hidden" value={training.date} />
                                    <select
                                      className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-span-2"
                                      name="player_id"
                                    >
                                      {players.map((player) => (
                                        <option key={player.id} value={player.id}>
                                          {player.name}
                                        </option>
                                      ))}
                                    </select>
                                    {[
                                      ["participation", "Beteiligung"],
                                      ["motivation", "Motivation"],
                                      ["training_quality", "Qualität"],
                                      ["effort", "Einsatz"]
                                    ].map(([name, label]) => (
                                      <select
                                        aria-label={label}
                                        className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        defaultValue="3"
                                        key={name}
                                        name={name}
                                      >
                                        {[1, 2, 3, 4, 5].map((value) => (
                                          <option key={value} value={value}>
                                            {value}
                                          </option>
                                        ))}
                                      </select>
                                    ))}
                                    <Textarea
                                      className="md:col-span-5"
                                      name="notes"
                                      placeholder="Kurzfeedback zum Training"
                                    />
                                    <Button className="md:col-span-1" type="submit">
                                      Speichern
                                    </Button>
                                  </ToastForm>
                                </details>
                              ) : null}

                              <div className="flex flex-col gap-2 no-print sm:flex-row sm:flex-wrap sm:items-center">
                                <PdfDownloadButton
                                  className="bg-foreground text-background hover:bg-foreground/90"
                                  href={`/api/pdf/training/${training.id}`}
                                  label="Trainingsplan als PDF"
                                  variant="default"
                                />
                                <Button
                                  disabled={isDeleting}
                                  onClick={() => toggleEditing(training.id)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <Pencil aria-hidden="true" className="h-4 w-4" />
                                  Bearbeiten
                                </Button>
                                <Button
                                  disabled={isPending || isDeleting}
                                  onClick={() => handleDuplicate(training.id)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <Copy aria-hidden="true" className="h-4 w-4" />
                                  Duplizieren
                                </Button>
                                <Button
                                  className="text-red-700 hover:bg-red-50 hover:text-red-800 sm:ml-auto"
                                  disabled={isPending || isDeleting}
                                  onClick={() => handleDelete(training)}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                                  {isDeleting ? "Lösche..." : "Löschen"}
                                </Button>
                              </div>

                              <div
                                className={cn(
                                  "grid transition-all duration-300 ease-out",
                                  isEditing ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                )}
                              >
                                <div className="overflow-hidden">
                                  <ToastForm
                                    action={updateTraining}
                                    className="space-y-4 rounded-2xl border border-border/70 bg-secondary/30 p-4"
                                    id={`edit-training-${training.id}`}
                                    onComplete={() => toggleEditing(training.id)}
                                    successMessage="Training aktualisiert"
                                  >
                                    <input name="id" type="hidden" defaultValue={training.id} />
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-date`}>Datum</Label>
                                        <Input defaultValue={training.date} id={`${training.id}-date`} name="date" required type="date" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-time`}>Uhrzeit</Label>
                                        <Input defaultValue={training.start_time ?? ""} id={`${training.id}-time`} name="start_time" type="time" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-duration`}>Dauer</Label>
                                        <Input defaultValue={training.duration_minutes ?? ""} id={`${training.id}-duration`} name="duration_minutes" type="number" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-location`}>Ort</Label>
                                        <Input defaultValue={training.location ?? ""} id={`${training.id}-location`} name="location" />
                                      </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-focus`}>Schwerpunkt</Label>
                                        <Input defaultValue={training.focus} id={`${training.id}-focus`} name="focus" required />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-age`}>Altersstufe</Label>
                                        <Input defaultValue={training.age_group ?? ""} id={`${training.id}-age`} name="age_group" />
                                      </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-intensity`}>Intensität</Label>
                                        <select
                                          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          defaultValue={training.intensity ?? "medium"}
                                          id={`${training.id}-intensity`}
                                          name="intensity"
                                        >
                                          <option value="low">Niedrig</option>
                                          <option value="medium">Mittel</option>
                                          <option value="high">Hoch</option>
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`${training.id}-participants`}>Teilnehmer</Label>
                                        <Input defaultValue={training.participants ?? ""} id={`${training.id}-participants`} name="participants" />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`${training.id}-goal`}>Trainingsziel</Label>
                                      <Textarea defaultValue={training.goal ?? ""} id={`${training.id}-goal`} name="goal" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`${training.id}-notes`}>Notizen</Label>
                                      <Textarea defaultValue={training.notes ?? ""} id={`${training.id}-notes`} name="notes" />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm">
                                      <input defaultChecked={training.is_template} name="is_template" type="checkbox" />
                                      Als Vorlage speichern
                                    </label>
                                    {phaseOrder.map((phaseType) => {
                                      const phase = phasesByType.get(phaseType);
                                      return (
                                        <div className="hidden" key={phaseType}>
                                          <input name={`${phaseType}_title`} type="hidden" defaultValue={phase?.title ?? ""} />
                                          <input name={`${phaseType}_duration`} type="hidden" defaultValue={phase?.duration_minutes ?? ""} />
                                          <input name={`${phaseType}_description`} type="hidden" defaultValue={phase?.description ?? ""} />
                                          <input name={`${phaseType}_coaching`} type="hidden" defaultValue={phase?.coaching_points ?? ""} />
                                          <input name={`${phaseType}_organization`} type="hidden" defaultValue={phase?.organization ?? ""} />
                                          <input name={`${phaseType}_material`} type="hidden" defaultValue={phase?.material ?? ""} />
                                          <input name={`${phaseType}_players`} type="hidden" defaultValue={phase?.player_count ?? ""} />
                                          <input name={`${phaseType}_field`} type="hidden" defaultValue={phase?.field_size ?? ""} />
                                          <input name={`${phaseType}_variations`} type="hidden" defaultValue={phase?.variations ?? ""} />
                                          <input name={`${phaseType}_load`} type="hidden" defaultValue={phase?.load_management ?? ""} />
                                        </div>
                                      );
                                    })}
                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                      <Button className="w-full sm:w-auto" onClick={() => toggleEditing(training.id)} type="button" variant="outline">
                                        Abbrechen
                                      </Button>
                                      <Button className="w-full sm:w-auto" type="submit">
                                        <Save aria-hidden="true" className="h-4 w-4" />
                                        Speichern
                                      </Button>
                                    </div>
                                  </ToastForm>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                      </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
