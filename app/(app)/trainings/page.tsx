import {
  Bot,
  CalendarPlus,
  Copy,
  Save,
  Trash2
} from "lucide-react";
import {
  createAiTrainingDraft,
  createPresetTraining,
  createTraining,
  deleteTraining,
  duplicateTraining,
  saveAttendance,
  updateTraining
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";
import type { AttendanceStatus, TrainingPhase, TrainingPhaseType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TrainingsPageProps {
  searchParams?: Promise<{
    date?: string;
  }>;
}

const phaseConfig: {
  label: string;
  type: TrainingPhaseType;
}[] = [
  { type: "warmup", label: "Warm-up" },
  { type: "technique", label: "Technik" },
  { type: "tactics", label: "Taktik" },
  { type: "game_form", label: "Spielform" },
  { type: "finish", label: "Abschluss" },
  { type: "cooldown", label: "Cooldown" }
];

function phaseByType(phases: TrainingPhase[], type: TrainingPhaseType) {
  return phases.find((phase) => phase.phase_type === type);
}

function phaseLabel(type: TrainingPhaseType) {
  return phaseConfig.find((phase) => phase.type === type)?.label ?? type;
}

function safeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIsoDate();
}

function TrainingTimeline({
  phases,
  totalMinutes
}: {
  phases: TrainingPhase[];
  totalMinutes: number;
}) {
  if (phases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
        Noch keine Phasen. Öffne “Training bearbeiten” und lege den Ablauf als Timeline an.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Ablauf</p>
        <Badge variant="secondary">{totalMinutes || 0} Min geplant</Badge>
      </div>
      <div className="mt-4 grid gap-3">
        {phases.map((phase, index) => (
          <div
            className="grid gap-3 rounded-xl bg-white p-3 shadow-sm shadow-slate-950/5 sm:grid-cols-[34px_1fr_auto]"
            key={phase.id}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{phaseLabel(phase.phase_type)}</Badge>
                <p className="truncate font-semibold">{phase.title}</p>
              </div>
              {phase.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {phase.description}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {phase.material ? <span>Material: {phase.material}</span> : null}
                {phase.field_size ? <span>Feld: {phase.field_size}</span> : null}
                {phase.player_count ? <span>Spieler: {phase.player_count}</span> : null}
              </div>
            </div>
            <div className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold sm:self-start">
              {phase.duration_minutes ?? 0} Min
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseFields({
  phase,
  type
}: {
  phase?: TrainingPhase;
  type: TrainingPhaseType;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-background/70 p-4 lg:grid-cols-[1fr_90px]">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${type}_title`}>Titel</Label>
          <Input
            defaultValue={phase?.title ?? ""}
            id={`${type}_title`}
            name={`${type}_title`}
            placeholder="Rondo mit Umschalten"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${type}_duration`}>Minuten</Label>
          <Input
            defaultValue={phase?.duration_minutes ?? ""}
            id={`${type}_duration`}
            name={`${type}_duration`}
            type="number"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`${type}_description`}>Beschreibung</Label>
          <Textarea
            defaultValue={phase?.description ?? ""}
            id={`${type}_description`}
            name={`${type}_description`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${type}_coaching`}>Coachingpunkte</Label>
          <Textarea
            defaultValue={phase?.coaching_points ?? ""}
            id={`${type}_coaching`}
            name={`${type}_coaching`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${type}_organization`}>Organisation</Label>
          <Textarea
            defaultValue={phase?.organization ?? ""}
            id={`${type}_organization`}
            name={`${type}_organization`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${type}_material`}>Material</Label>
          <Input
            defaultValue={phase?.material ?? ""}
            id={`${type}_material`}
            name={`${type}_material`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${type}_players`}>Spieler</Label>
            <Input
              defaultValue={phase?.player_count ?? ""}
              id={`${type}_players`}
              name={`${type}_players`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${type}_field`}>Feld</Label>
            <Input
              defaultValue={phase?.field_size ?? ""}
              id={`${type}_field`}
              name={`${type}_field`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${type}_load`}>Belastung</Label>
            <Input
              defaultValue={phase?.load_management ?? ""}
              id={`${type}_load`}
              name={`${type}_load`}
            />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`${type}_variations`}>Varianten</Label>
          <Textarea
            defaultValue={phase?.variations ?? ""}
            id={`${type}_variations`}
            name={`${type}_variations`}
          />
        </div>
      </div>
    </div>
  );
}

export default async function TrainingsPage({ searchParams }: TrainingsPageProps) {
  const { supabase, team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const initialDate = safeDate(resolvedSearchParams?.date);
  const [playersResult, trainingsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position")
      .eq("team_id", team.id)
      .order("name", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("*")
      .eq("team_id", team.id)
      .order("date", { ascending: false })
      .limit(12)
  ]);

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  if (trainingsResult.error) {
    throw new Error(trainingsResult.error.message);
  }

  const players = playersResult.data ?? [];
  const trainings = trainingsResult.data ?? [];
  const trainingIds = trainings.map((training) => training.id);

  const [attendanceResult, phasesResult] =
    trainingIds.length > 0
      ? await Promise.all([
          supabase
            .from("attendance")
            .select("training_id,player_id,status")
            .eq("team_id", team.id)
            .in("training_id", trainingIds),
          supabase
            .from("training_phases")
            .select("*")
            .eq("team_id", team.id)
            .in("training_id", trainingIds)
            .order("sort_order", { ascending: true })
        ])
      : [
          { data: [], error: null },
          { data: [], error: null }
        ];

  if (attendanceResult.error) {
    throw new Error(attendanceResult.error.message);
  }

  if (phasesResult.error) {
    throw new Error(phasesResult.error.message);
  }

  const attendanceByTraining = new Map<string, Map<string, AttendanceStatus>>();
  for (const row of attendanceResult.data ?? []) {
    const map =
      attendanceByTraining.get(row.training_id) ??
      new Map<string, AttendanceStatus>();
    map.set(row.player_id, row.status);
    attendanceByTraining.set(row.training_id, map);
  }

  const phasesByTraining = new Map<string, TrainingPhase[]>();
  for (const phase of phasesResult.data ?? []) {
    phasesByTraining.set(phase.training_id, [
      ...(phasesByTraining.get(phase.training_id) ?? []),
      phase
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Plane Einheiten mit Ziel, Belastung, Phasen, Material und Coachingpunkten."
        title="Training"
      />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card className="border-emerald-200 bg-emerald-50/70">
            <CardHeader>
              <CardTitle>Training erstellen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createTraining} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="date">Datum</Label>
                    <Input
                      defaultValue={initialDate}
                      id="date"
                      name="date"
                      required
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Uhrzeit</Label>
                    <Input id="start_time" name="start_time" type="time" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="duration_minutes">Dauer</Label>
                    <Input
                      defaultValue="90"
                      id="duration_minutes"
                      name="duration_minutes"
                      type="number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ort</Label>
                    <Input id="location" name="location" placeholder="Platz 2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="focus">Schwerpunkt</Label>
                  <Input
                    id="focus"
                    name="focus"
                    placeholder="Pressing nach Ballverlust"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal">Trainingsziel</Label>
                  <Textarea id="goal" name="goal" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="age_group">Altersstufe</Label>
                    <Input
                      defaultValue={team.age_group ?? ""}
                      id="age_group"
                      name="age_group"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="intensity">Intensität</Label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue="medium"
                      id="intensity"
                      name="intensity"
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participants">Teilnehmer</Label>
                  <Input
                    id="participants"
                    name="participants"
                    placeholder="Alle Feldspieler, Torhüter separat"
                  />
                </div>
                <details className="rounded-xl border border-border bg-white/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Phasen direkt ausfüllen
                  </summary>
                  <div className="mt-4 space-y-4">
                    {phaseConfig.map((phase) => (
                      <div key={phase.type}>
                        <h3 className="mb-2 text-sm font-semibold">
                          {phase.label}
                        </h3>
                        <PhaseFields type={phase.type} />
                      </div>
                    ))}
                  </div>
                </details>
                <Button className="w-full" type="submit">
                  <CalendarPlus aria-hidden="true" className="h-4 w-4" />
                  Training speichern
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vorlagen-Bibliothek</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createPresetTraining} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="preset">Vorlage</Label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      id="preset"
                      name="preset"
                    >
                      <option value="pressing">Pressing nach Ballverlust</option>
                      <option value="buildup">Spielaufbau gegen Pressing</option>
                      <option value="finishing">Abschluss unter Druck</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preset-date">Datum</Label>
                    <Input
                      defaultValue={initialDate}
                      id="preset-date"
                      name="date"
                      required
                      type="date"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input name="start_time" type="time" />
                  <Input
                    defaultValue="90"
                    name="duration_minutes"
                    type="number"
                  />
                  <Input name="location" placeholder="Ort" />
                </div>
                <Button className="w-full" type="submit" variant="secondary">
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Vorlage als Training erstellen
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KI-Trainingsentwurf</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createAiTrainingDraft} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ai-date">Datum</Label>
                  <Input
                    defaultValue={initialDate}
                    id="ai-date"
                    name="date"
                    required
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-focus">Ziel / Schwerpunkt</Label>
                  <Input
                    id="ai-focus"
                    name="focus"
                    placeholder="Spielaufbau gegen Pressing"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    defaultValue={team.age_group ?? ""}
                    name="age_group"
                    placeholder="U16"
                  />
                  <Input
                    defaultValue="90"
                    name="duration_minutes"
                    type="number"
                  />
                </div>
                <Button className="w-full" type="submit" variant="secondary">
                  <Bot aria-hidden="true" className="h-4 w-4" />
                  KI-Draft erzeugen
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Erstellt aktuell einen strukturierten Mock-Entwurf. Die Action
                  ist vorbereitet für echte Modellintegration.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {trainings.length > 0 ? (
            trainings.map((training) => {
              const attendance =
                attendanceByTraining.get(training.id) ??
                new Map<string, AttendanceStatus>();
              const phases = phasesByTraining.get(training.id) ?? [];
              const presentCount = players.filter(
                (player) => attendance.get(player.id) === "present"
              ).length;
              const totalMinutes = phases.reduce(
                (sum, phase) => sum + (phase.duration_minutes ?? 0),
                0
              );
              const aiChecks = [
                phases.length < 4
                  ? "Training hat wenige Phasen. Ergänze mindestens Warm-up, Hauptteil, Spielform und Abschluss."
                  : null,
                training.duration_minutes &&
                totalMinutes &&
                Math.abs(training.duration_minutes - totalMinutes) > 10
                  ? `Phasendauer (${totalMinutes} Min) weicht von Trainingsdauer (${training.duration_minutes} Min) ab.`
                  : null,
                !training.goal
                  ? "Trainingsziel fehlt. Ein klares Ziel macht Coachingpunkte messbarer."
                  : null,
                phases.length > 0 &&
                phases.every((phase) => !phase.material)
                  ? "Keine Materialangaben in den Phasen. Für Druckversion und Aufbau wäre das hilfreich."
                  : null
              ].filter((item): item is string => item !== null);

              return (
                <Card className="print-card" key={training.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle>{training.focus}</CardTitle>
                          {training.intensity ? (
                            <Badge variant="secondary">
                              {training.intensity}
                            </Badge>
                          ) : null}
                          {training.is_template ? (
                            <Badge variant="success">Vorlage</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatDate(training.date)}
                          {training.start_time
                            ? ` · ${training.start_time.slice(0, 5)}`
                            : ""}
                          {training.location ? ` · ${training.location}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 no-print">
                        <form action={duplicateTraining}>
                          <input name="id" type="hidden" value={training.id} />
                          <Button size="sm" type="submit" variant="outline">
                            <Copy aria-hidden="true" className="h-4 w-4" />
                            Duplizieren
                          </Button>
                        </form>
                        <PrintButton />
                        <form action={deleteTraining}>
                          <input name="id" type="hidden" value={training.id} />
                          <Button size="sm" type="submit" variant="ghost">
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl bg-secondary px-3 py-3">
                        <p className="text-xs text-muted-foreground">Dauer</p>
                        <p className="font-semibold">
                          {training.duration_minutes
                            ? `${training.duration_minutes} Min`
                            : totalMinutes
                              ? `${totalMinutes} Min`
                              : "Offen"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-secondary px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Phasen
                        </p>
                        <p className="font-semibold">{phases.length}</p>
                      </div>
                      <div className="rounded-xl bg-secondary px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Anwesend
                        </p>
                        <p className="font-semibold">
                          {presentCount}/{players.length}
                        </p>
                      </div>
                      <div className="rounded-xl bg-secondary px-3 py-3">
                        <p className="text-xs text-muted-foreground">
                          Altersstufe
                        </p>
                        <p className="font-semibold">
                          {training.age_group ?? "Offen"}
                        </p>
                      </div>
                    </div>

                    {training.goal ? (
                      <p className="line-clamp-2 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                        {training.goal}
                      </p>
                    ) : null}

                    <TrainingTimeline
                      phases={phases}
                      totalMinutes={totalMinutes}
                    />

                    <div className="rounded-xl border border-border bg-background/70 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <Bot aria-hidden="true" className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold">KI-Plancheck</p>
                        </div>
                        <Badge variant={aiChecks.length > 0 ? "secondary" : "success"}>
                          {aiChecks.length > 0 ? `${aiChecks.length} Hinweise` : "Logisch aufgebaut"}
                        </Badge>
                      </div>
                      {aiChecks.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm leading-6 text-muted-foreground">
                          {aiChecks.map((check) => (
                            <li key={check}>{check}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          Ziel, Phasen und Dauer wirken stimmig. Für echte KI-Integration ist diese Prüfstruktur vorbereitet.
                        </p>
                      )}
                    </div>

                    <details className="rounded-xl border border-border p-4">
                      <summary className="cursor-pointer text-sm font-semibold">
                        Training bearbeiten
                      </summary>
                      <form action={updateTraining} className="mt-4 space-y-4">
                        <input name="id" type="hidden" value={training.id} />
                        <div className="grid gap-3 md:grid-cols-4">
                          <Input
                            defaultValue={training.date}
                            name="date"
                            required
                            type="date"
                          />
                          <Input
                            defaultValue={training.start_time ?? ""}
                            name="start_time"
                            type="time"
                          />
                          <Input
                            defaultValue={training.duration_minutes ?? ""}
                            name="duration_minutes"
                            type="number"
                          />
                          <Input
                            defaultValue={training.location ?? ""}
                            name="location"
                            placeholder="Ort"
                          />
                        </div>
                        <Input
                          defaultValue={training.focus}
                          name="focus"
                          required
                        />
                        <Textarea
                          defaultValue={training.goal ?? ""}
                          name="goal"
                          placeholder="Trainingsziel"
                        />
                        <div className="grid gap-3 md:grid-cols-3">
                          <Input
                            defaultValue={training.age_group ?? ""}
                            name="age_group"
                            placeholder="Altersstufe"
                          />
                          <select
                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            defaultValue={training.intensity ?? "medium"}
                            name="intensity"
                          >
                            <option value="low">Niedrig</option>
                            <option value="medium">Mittel</option>
                            <option value="high">Hoch</option>
                          </select>
                          <Input
                            defaultValue={training.participants ?? ""}
                            name="participants"
                            placeholder="Teilnehmer"
                          />
                        </div>
                        <Textarea
                          defaultValue={training.notes ?? ""}
                          name="notes"
                          placeholder="Notizen"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            defaultChecked={training.is_template}
                            name="is_template"
                            type="checkbox"
                          />
                          Als Vorlage speichern
                        </label>
                        <div className="space-y-4">
                          {phaseConfig.map((config) => {
                            const phase = phaseByType(phases, config.type);
                            return (
                              <div key={config.type}>
                                <h3 className="mb-2 text-sm font-semibold">
                                  {config.label}
                                </h3>
                                <PhaseFields phase={phase} type={config.type} />
                              </div>
                            );
                          })}
                        </div>
                        <Button type="submit">
                          <Save aria-hidden="true" className="h-4 w-4" />
                          Training speichern
                        </Button>
                      </form>
                    </details>

                    {phases.length > 0 ? (
                      <details className="rounded-xl border border-border p-4">
                        <summary className="cursor-pointer text-sm font-semibold">
                          Phasen anzeigen ({phases.length})
                        </summary>
                        <div className="mt-4 grid gap-3">
                        {phases.map((phase) => (
                          <div
                            className="rounded-xl border border-border bg-background/70 p-4"
                            key={phase.id}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <Badge variant="secondary">
                                  {
                                    phaseConfig.find(
                                      (item) => item.type === phase.phase_type
                                    )?.label
                                  }
                                </Badge>
                                <h3 className="mt-2 font-semibold">
                                  {phase.title}
                                </h3>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {phase.duration_minutes ?? 0} Min
                              </span>
                            </div>
                            {phase.description ? (
                              <p className="mt-3 text-sm leading-6">
                                {phase.description}
                              </p>
                            ) : null}
                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                              {phase.coaching_points ? (
                                <p className="rounded-lg bg-secondary p-3 text-xs leading-5">
                                  <strong>Coaching:</strong>{" "}
                                  {phase.coaching_points}
                                </p>
                              ) : null}
                              {phase.material ? (
                                <p className="rounded-lg bg-secondary p-3 text-xs leading-5">
                                  <strong>Material:</strong> {phase.material}
                                </p>
                              ) : null}
                              {phase.variations ? (
                                <p className="rounded-lg bg-secondary p-3 text-xs leading-5">
                                  <strong>Varianten:</strong> {phase.variations}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        </div>
                      </details>
                    ) : null}

                    {players.length > 0 ? (
                      <details className="rounded-xl border border-border p-4 no-print">
                        <summary className="cursor-pointer text-sm font-semibold">
                          Anwesenheit erfassen ({presentCount}/{players.length})
                        </summary>
                        <form action={saveAttendance} className="mt-4 space-y-3">
                        <input
                          name="training_id"
                          type="hidden"
                          value={training.id}
                        />
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {players.map((player) => {
                            const status = attendance.get(player.id);

                            return (
                              <label
                                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3 text-sm"
                                key={player.id}
                              >
                                <input
                                  name="player_id"
                                  type="hidden"
                                  value={player.id}
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
                        </form>
                      </details>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <EmptyState
              body="Erstelle ein Training oder nutze den KI-Draft für eine erste Struktur."
              title="Noch keine Trainings geplant."
            />
          )}
        </div>
      </section>
    </div>
  );
}
