import Link from "next/link";
import { Award, CalendarDays, Medal, TrendingUp } from "lucide-react";
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
import { evaluationAverage, healthRisk, winnerPointTotal } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PlayerModePageProps {
  searchParams?: Promise<{
    player?: string;
  }>;
}

export default async function PlayerModePage({
  searchParams
}: PlayerModePageProps) {
  const { membership, supabase, team, user } = await requireActiveTeam();
  const params = await searchParams;
  const today = todayIsoDate();
  const [playersResult, trainingsResult, matchesResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position,team_category,player_account_email")
      .eq("team_id", team.id)
      .order("last_name", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("id,date,start_time,focus,goal")
      .eq("team_id", team.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(6),
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,match_goals")
      .eq("team_id", team.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(6)
  ]);

  for (const result of [playersResult, trainingsResult, matchesResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const players = playersResult.data ?? [];
  const linkedPlayer = players.find(
    (player) =>
      player.player_account_email?.toLowerCase() === user.email?.toLowerCase()
  );
  const isStaffPreview =
    membership.role === "owner" ||
    membership.role === "head_coach" ||
    membership.role === "coach";
  const selectedPlayerId = params?.player ?? linkedPlayer?.id;
  const selectedOption =
    players.find((player) => player.id === selectedPlayerId) ?? null;

  const [
    playerResult,
    pointsResult,
    evaluationsResult,
    checkinsResult,
    awardsResult
  ] = selectedOption
    ? await Promise.all([
        supabase
          .from("players")
          .select("*")
          .eq("id", selectedOption.id)
          .eq("team_id", team.id)
          .single(),
        supabase
          .from("winner_points")
          .select("*")
          .eq("team_id", team.id)
          .eq("player_id", selectedOption.id)
          .order("awarded_at", { ascending: false })
          .limit(100),
        supabase
          .from("player_evaluations")
          .select("*")
          .eq("team_id", team.id)
          .eq("player_id", selectedOption.id)
          .order("evaluation_date", { ascending: false })
          .limit(30),
        supabase
          .from("health_checkins")
          .select("*")
          .eq("team_id", team.id)
          .eq("player_id", selectedOption.id)
          .order("checkin_date", { ascending: false })
          .limit(10),
        supabase
          .from("player_awards")
          .select("*")
          .eq("team_id", team.id)
          .eq("player_id", selectedOption.id)
          .order("award_date", { ascending: false })
          .limit(20)
      ])
    : [
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];

  for (const result of [
    playerResult,
    pointsResult,
    evaluationsResult,
    checkinsResult,
    awardsResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const player = playerResult.data;
  const points = pointsResult.data ?? [];
  const evaluations = evaluationsResult.data ?? [];
  const checkins = checkinsResult.data ?? [];
  const awards = awardsResult.data ?? [];
  const evaluationValues = evaluations
    .map(evaluationAverage)
    .filter((value): value is number => value !== null);
  const avgEvaluation =
    evaluationValues.length > 0
      ? evaluationValues.reduce((sum, value) => sum + value, 0) /
        evaluationValues.length
      : null;
  const latestHealth = checkins[0] ?? null;
  const risk = latestHealth ? healthRisk(latestHealth) : null;
  const trainings = trainingsResult.data ?? [];
  const matches = matchesResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Vereinfachte, motivierende Spieleransicht ohne sensible Daten anderer Spieler."
        title="Spieler-Modus"
      />

      {isStaffPreview ? (
      <Card className="border-emerald-200 bg-emerald-50/70">
        <CardContent className="p-5">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium" htmlFor="player">
                Spieler auswählen
              </label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={selectedPlayerId ?? ""}
                id="player"
                name="player"
              >
                <option value="">Bitte auswählen</option>
                {players.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Öffnen</Button>
          </form>
        </CardContent>
      </Card>
      ) : null}

      {player ? (
        <>
          <section className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-300">
                  Mein CoachOS
                </p>
                <h2 className="mt-3 text-4xl font-semibold">{player.name}</h2>
                <p className="mt-2 text-sm text-slate-300">
                  {player.position ?? "Position offen"}
                  {player.team_category ? ` · ${player.team_category}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/10 p-4 text-center">
                  <Medal
                    aria-hidden="true"
                    className="mx-auto h-5 w-5 text-emerald-300"
                  />
                  <p className="mt-2 text-2xl font-semibold">
                    {winnerPointTotal(points)}
                  </p>
                  <p className="text-xs text-slate-300">Winner</p>
                </div>
                <div className="rounded-xl bg-white/10 p-4 text-center">
                  <TrendingUp
                    aria-hidden="true"
                    className="mx-auto h-5 w-5 text-emerald-300"
                  />
                  <p className="mt-2 text-2xl font-semibold">
                    {avgEvaluation !== null ? avgEvaluation.toFixed(1) : "-"}
                  </p>
                  <p className="text-xs text-slate-300">Entwicklung</p>
                </div>
                <div className="rounded-xl bg-white/10 p-4 text-center">
                  <Award
                    aria-hidden="true"
                    className="mx-auto h-5 w-5 text-emerald-300"
                  />
                  <p className="mt-2 text-2xl font-semibold">
                    {awards.length}
                  </p>
                  <p className="text-xs text-slate-300">Awards</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Meine Stärken</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {player.strengths ?? "Noch offen."}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Meine Ziele</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {player.football_goals ??
                    player.development_goals ??
                    "Noch offen."}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Check-in</CardTitle>
              </CardHeader>
              <CardContent>
                {latestHealth ? (
                  <div>
                    <Badge
                      variant={
                        risk === "red"
                          ? "destructive"
                          : risk === "yellow"
                            ? "secondary"
                            : "success"
                      }
                    >
                      {risk === "red"
                        ? "Belastung prüfen"
                        : risk === "yellow"
                          ? "Aufmerksam"
                          : "Alles ok"}
                    </Badge>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {formatDate(latestHealth.checkin_date)} · Energie{" "}
                      {latestHealth.energy}/5 · Motivation{" "}
                      {latestHealth.motivation}/5
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Noch kein Check-in vorhanden.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Kalender</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...trainings, ...matches]
                  .map((item) =>
                    "focus" in item
                      ? {
                          id: `training-${item.id}`,
                          date: item.date,
                          time: item.start_time,
                          title: item.focus,
                          label: "Training",
                          body: item.goal
                        }
                      : {
                          id: `match-${item.id}`,
                          date: item.date,
                          time: item.kickoff_time,
                          title: item.opponent,
                          label: "Spiel",
                          body: item.match_goals
                        }
                  )
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .slice(0, 8)
                  .map((event) => (
                    <div
                      className="rounded-xl border border-border bg-background/70 p-4"
                      key={event.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge variant="secondary">{event.label}</Badge>
                          <p className="mt-2 font-semibold">{event.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDate(event.date)}
                            {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
                          </p>
                        </div>
                        <CalendarDays
                          aria-hidden="true"
                          className="h-5 w-5 text-primary"
                        />
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feedback & Entwicklung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evaluations.length > 0 ? (
                  evaluations.slice(0, 5).map((evaluation) => (
                    <div
                      className="rounded-xl border border-border bg-background/70 p-4"
                      key={evaluation.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="success">
                          {evaluationAverage(evaluation)?.toFixed(1) ?? "-"}/5
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(evaluation.evaluation_date)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {evaluation.notes ?? "Keine Notiz."}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Noch kein Feedback vorhanden." />
                )}
              </CardContent>
            </Card>
          </section>

          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href={`/players/${player.id}`}>Trainer-Portfolio</Link>
            </Button>
          </div>
        </>
      ) : (
        <EmptyState title="Wähle einen Spieler, um den Spieler-Modus zu öffnen." />
      )}
    </div>
  );
}
