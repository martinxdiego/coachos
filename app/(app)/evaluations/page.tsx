import Link from "next/link";
import {
  AlertTriangle,
  Save,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import {
  deletePlayerEvaluation,
  savePlayerEvaluation,
  updatePlayerEvaluation
} from "@/app/actions";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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
import { evaluationAverage } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";
import type { EvaluationContextType } from "@/lib/types";

export const dynamic = "force-dynamic";

const contextLabels: Record<EvaluationContextType, string> = {
  event: "Event",
  match: "Spiel",
  monday_training: "Montagstraining",
  training: "Training"
};

const criteria = [
  ["participation", "Beteiligung"],
  ["motivation", "Motivation"],
  ["training_quality", "Trainingsqualität"],
  ["match_quality", "Spielqualität"],
  ["behavior", "Verhalten"],
  ["effort", "Einsatz"],
  ["concentration", "Konzentration"]
] as const;

export default async function EvaluationsPage() {
  const { supabase, team } = await requireActiveTeam();
  const today = todayIsoDate();
  const [playersResult, trainingsResult, matchesResult, evaluationsResult] =
    await Promise.all([
      supabase
        .from("players")
        .select("id,name,position,team_category")
        .eq("team_id", team.id)
        .order("last_name", { ascending: true }),
      supabase
        .from("training_sessions")
        .select("id,date,focus")
        .eq("team_id", team.id)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("matches")
        .select("id,date,opponent")
        .eq("team_id", team.id)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("player_evaluations")
        .select("*")
        .eq("team_id", team.id)
        .order("evaluation_date", { ascending: false })
        .limit(700)
    ]);

  for (const result of [
    playersResult,
    trainingsResult,
    matchesResult,
    evaluationsResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const players = playersResult.data ?? [];
  const trainings = trainingsResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const evaluations = evaluationsResult.data ?? [];
  const knownContextIds = new Set([
    ...trainings.map((training) => training.id),
    ...matches.map((match) => match.id)
  ]);
  const overview = players
    .map((player) => {
      const rows = evaluations.filter((row) => row.player_id === player.id);
      const averages = rows
        .map(evaluationAverage)
        .filter((value): value is number => value !== null);
      const current = averages[0] ?? null;
      const previous = averages.slice(1, 5);
      const previousAverage =
        previous.length > 0
          ? previous.reduce((sum, value) => sum + value, 0) / previous.length
          : null;
      const seasonAverage =
        averages.length > 0
          ? averages.reduce((sum, value) => sum + value, 0) / averages.length
          : null;
      const trend =
        current !== null && previousAverage !== null
          ? current - previousAverage
          : null;

      return {
        player,
        rows,
        seasonAverage,
        trend,
        latest: rows[0] ?? null
      };
    })
    .sort((a, b) => {
      const aRisk =
        (a.seasonAverage !== null && a.seasonAverage < 3 ? 2 : 0) +
        (a.trend !== null && a.trend < -0.4 ? 1 : 0);
      const bRisk =
        (b.seasonAverage !== null && b.seasonAverage < 3 ? 2 : 0) +
        (b.trend !== null && b.trend < -0.4 ? 1 : 0);
      return bRisk - aRisk;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        description="Schnelle 1-bis-5-Bewertungen pro Training, Spiel oder Event mit Trainerübersicht."
        title="Spielerbewertungen"
      />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="h-fit border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Bewertung erfassen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={savePlayerEvaluation} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eval-player">Spieler</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="eval-player"
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
                  <Label htmlFor="eval-context">Kontext</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="eval-context"
                    name="context_type"
                  >
                    {Object.entries(contextLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eval-date">Datum</Label>
                  <Input
                    defaultValue={today}
                    id="eval-date"
                    name="evaluation_date"
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eval-context-label">Einheit / Gegner</Label>
                  <Input
                    id="eval-context-label"
                    name="context_label"
                    placeholder="z.B. Pressing, vs FC Horw"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  name="context_id"
                >
                  <option value="">Ohne Verknüpfung</option>
                  <optgroup label="Trainings">
                    {trainings.map((training) => (
                      <option key={training.id} value={training.id}>
                        {formatDate(training.date)} · {training.focus}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Spiele">
                    {matches.map((match) => (
                      <option key={match.id} value={match.id}>
                        {formatDate(match.date)} · {match.opponent}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {criteria.map(([name, label]) => (
                  <div className="space-y-2" key={name}>
                    <Label htmlFor={`eval-${name}`}>{label}</Label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue="3"
                      id={`eval-${name}`}
                      name={name}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {value} Sterne
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <Textarea name="notes" placeholder="Kurze Notiz / Beobachtung" />
              <Button className="w-full" type="submit">
                <Star aria-hidden="true" className="h-4 w-4" />
                Bewertung speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trainerübersicht</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.length > 0 ? (
              <div className="grid gap-3">
                {overview.map((row) => {
                  const needsTalk =
                    (row.seasonAverage !== null && row.seasonAverage < 3) ||
                    (row.trend !== null && row.trend < -0.4);

                  return (
                    <div
                      className="grid gap-3 rounded-xl border border-border bg-background/70 p-4 lg:grid-cols-[1.2fr_0.7fr_0.7fr_1fr_auto]"
                      key={row.player.id}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{row.player.name}</p>
                          {needsTalk ? (
                            <Badge variant="destructive">
                              <AlertTriangle
                                aria-hidden="true"
                                className="mr-1 h-3 w-3"
                              />
                              Gespräch
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.player.position ?? "Position offen"}
                          {row.player.team_category
                            ? ` · ${row.player.team_category}`
                            : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Schnitt
                        </p>
                        <p className="text-2xl font-semibold">
                          {row.seasonAverage !== null
                            ? row.seasonAverage.toFixed(1)
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Trend</p>
                        <div className="mt-1 flex items-center gap-2">
                          {row.trend !== null && row.trend >= 0 ? (
                            <TrendingUp
                              aria-hidden="true"
                              className="h-4 w-4 text-emerald-700"
                            />
                          ) : row.trend !== null ? (
                            <TrendingDown
                              aria-hidden="true"
                              className="h-4 w-4 text-red-700"
                            />
                          ) : null}
                          <span className="font-semibold">
                            {row.trend !== null ? row.trend.toFixed(1) : "-"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Letzte Bewertung
                        </p>
                        <p className="mt-1 text-sm">
                          {row.latest
                            ? `${formatDate(row.latest.evaluation_date)} · ${contextLabels[row.latest.context_type]}`
                            : "Noch keine"}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/players/${row.player.id}`}>Profil</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Noch keine Spieler vorhanden." />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Bewertungen bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          {evaluations.length > 0 ? (
            <div className="grid gap-3">
              {evaluations.slice(0, 16).map((evaluation) => {
                const player = players.find(
                  (item) => item.id === evaluation.player_id
                );
                const average = evaluationAverage(evaluation);

                return (
                  <details
                    className="rounded-xl border border-border bg-background/70 p-4"
                    key={evaluation.id}
                  >
                    <summary className="cursor-pointer">
                      <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="font-semibold">
                            {player?.name ?? "Unbekannter Spieler"}
                          </span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {formatDate(evaluation.evaluation_date)} ·{" "}
                            {contextLabels[evaluation.context_type]}
                          </span>
                        </span>
                        <Badge variant="secondary">
                          {average !== null ? `${average.toFixed(1)}/5` : "Offen"}
                        </Badge>
                      </span>
                    </summary>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_auto]">
                      <form action={updatePlayerEvaluation} className="space-y-4">
                        <input name="id" type="hidden" value={evaluation.id} />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Spieler</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={evaluation.player_id}
                              name="player_id"
                            >
                              {players.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Kontext</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={evaluation.context_type}
                              name="context_type"
                            >
                              {Object.entries(contextLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Datum</Label>
                            <Input
                              defaultValue={evaluation.evaluation_date}
                              name="evaluation_date"
                              type="date"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Einheit / Gegner</Label>
                            <Input
                              defaultValue={evaluation.context_label ?? ""}
                              name="context_label"
                            />
                          </div>
                        </div>
                        <select
                          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          defaultValue={evaluation.context_id ?? ""}
                          name="context_id"
                        >
                          <option value="">Ohne Verknüpfung</option>
                          {evaluation.context_id &&
                          !knownContextIds.has(evaluation.context_id) ? (
                            <option value={evaluation.context_id}>
                              Bestehende Verknüpfung
                            </option>
                          ) : null}
                          <optgroup label="Trainings">
                            {trainings.map((training) => (
                              <option key={training.id} value={training.id}>
                                {formatDate(training.date)} · {training.focus}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Spiele">
                            {matches.map((match) => (
                              <option key={match.id} value={match.id}>
                                {formatDate(match.date)} · {match.opponent}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {criteria.map(([name, label]) => (
                            <div className="space-y-2" key={name}>
                              <Label>{label}</Label>
                              <select
                                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                defaultValue={String(evaluation[name] ?? "")}
                                name={name}
                              >
                                <option value="">Offen</option>
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <Textarea
                          defaultValue={evaluation.notes ?? ""}
                          name="notes"
                          placeholder="Notiz"
                        />
                        <Button type="submit">
                          <Save aria-hidden="true" className="h-4 w-4" />
                          Bewertung speichern
                        </Button>
                      </form>
                      <ConfirmDeleteForm
                        action={deletePlayerEvaluation}
                        confirm={{
                          title: "Bewertung löschen?",
                          description:
                            "Diese Bewertung wird unwiderruflich entfernt."
                        }}
                        successMessage="Bewertung gelöscht"
                        errorMessage="Bewertung konnte nicht gelöscht werden."
                      >
                        <input name="id" type="hidden" value={evaluation.id} />
                        <input
                          name="player_id"
                          type="hidden"
                          value={evaluation.player_id}
                        />
                        <Button
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          type="submit"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Löschen
                        </Button>
                      </ConfirmDeleteForm>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Noch keine Bewertungen zum Bearbeiten." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
