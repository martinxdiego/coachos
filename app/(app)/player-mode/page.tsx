import Link from "next/link";
import {
  Award,
  CalendarDays,
  ChevronRight,
  Flame,
  Medal,
  Star,
  TrendingUp,
  Trophy,
  UserRound
} from "lucide-react";
import { submitPlayerSeasonForm } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PlayerModeCheckin } from "@/components/player-mode-checkin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { evaluationAverage, healthRisk, winnerPointTotal } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PlayerModePageProps {
  searchParams?: Promise<{
    player?: string;
  }>;
}

function streakLength(checkinDates: string[]): number {
  if (checkinDates.length === 0) return 0;
  const seen = new Set(checkinDates);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow today to be missing — count back from yesterday if today isn't done.
  const todayIso = cursor.toISOString().slice(0, 10);
  if (!seen.has(todayIso)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!seen.has(iso)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default async function PlayerModePage({
  searchParams
}: PlayerModePageProps) {
  const { membership, team, user } = await requireActiveTeam();
  const params = await searchParams;
  const today = todayIsoDate();
  const todayStart = new Date(`${today}T00:00:00`);

  const [dbPlayers, dbTrainings, dbMatches] = await Promise.all([
    db.player.findMany({
      where: { workspaceId: team.id },
      select: {
        id: true,
        name: true,
        position: true,
        playerAccountEmail: true,
        lastName: true
      },
      orderBy: {
        lastName: "asc"
      }
    }),
    db.training.findMany({
      where: {
        workspaceId: team.id,
        date: { gte: todayStart }
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        focus: true,
        goal: true,
        location: true
      },
      orderBy: { date: "asc" },
      take: 6
    }),
    db.match.findMany({
      where: {
        workspaceId: team.id,
        date: { gte: todayStart }
      },
      select: {
        id: true,
        date: true,
        kickoffTime: true,
        opponent: true,
        matchGoals: true,
        location: true
      },
      orderBy: { date: "asc" },
      take: 6
    })
  ]);

  const players = dbPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    team_category: null,
    player_account_email: p.playerAccountEmail
  }));

  const linkedPlayer = players.find(
    (player) =>
      player.player_account_email?.toLowerCase() === user.email?.toLowerCase()
  );
  const isStaffPreview =
    membership.role === "OWNER" ||
    membership.role === "COACH" ||
    membership.role === "ASSISTANT";
  const selectedPlayerId = params?.player ?? linkedPlayer?.id;
  const selectedOption =
    players.find((player) => player.id === selectedPlayerId) ?? null;

  const [
    dbPlayer,
    dbPoints,
    dbEvaluations,
    dbCheckins,
    dbAwards,
    dbFeedback
  ] = selectedOption
    ? await Promise.all([
        db.player.findFirst({
          where: {
            id: selectedOption.id,
            workspaceId: team.id
          }
        }),
        db.winnerPoint.findMany({
          where: {
            workspaceId: team.id,
            playerId: selectedOption.id
          },
          orderBy: { awardedAt: "desc" },
          take: 100
        }),
        db.rating.findMany({
          where: {
            player: {
              workspaceId: team.id
            },
            playerId: selectedOption.id
          },
          orderBy: { date: "desc" },
          take: 30
        }),
        db.healthCheck.findMany({
          where: {
            player: {
              workspaceId: team.id
            },
            playerId: selectedOption.id
          },
          orderBy: { date: "desc" },
          take: 60
        }),
        db.award.findMany({
          where: {
            workspaceId: team.id,
            playerId: selectedOption.id
          },
          orderBy: { date: "desc" },
          take: 20
        }),
        db.playerFeedback.findMany({
          where: {
            workspaceId: team.id,
            playerId: selectedOption.id
          },
          orderBy: { createdAt: "desc" },
          take: 5
        })
      ])
    : [null, [], [], [], [], []];

  const player = dbPlayer
    ? {
        ...dbPlayer,
        first_name: dbPlayer.firstName,
        photo_url: dbPlayer.photoUrl,
        jersey_number: dbPlayer.jerseyNumber ?? dbPlayer.number,
        team_category: null,
        contact: dbPlayer.contact,
        parent_contact: dbPlayer.parentContact,
        emergency_contact: dbPlayer.emergencyContact,
        strong_foot: dbPlayer.strongFoot,
        favorite_team: dbPlayer.favoriteTeam,
        favorite_player: dbPlayer.favoritePlayer,
        football_goals: dbPlayer.footballGoals,
        strengths: dbPlayer.strengths,
        weaknesses: dbPlayer.weaknesses,
        motivation: dbPlayer.motivation,
        allergies: dbPlayer.allergies,
        injuries: dbPlayer.injuries,
        limitations: dbPlayer.limitations,
        medications: dbPlayer.medications,
        development_goals: dbPlayer.developmentGoals
      }
    : null;

  const points = dbPoints.map((p) => ({
    id: p.id,
    points: p.points,
    awarded_at: p.awardedAt.toISOString()
  }));

  const evaluations = dbEvaluations.map((e) => ({
    id: e.id,
    evaluation_date: e.date.toISOString().slice(0, 10),
    participation: e.participation,
    motivation: e.motivation,
    training_quality: e.trainingQuality,
    match_quality: e.matchQuality ?? e.playingQuality,
    behavior: e.behavior ?? e.behaviour,
    effort: e.effort,
    concentration: e.concentration,
    notes: e.notes ?? e.comment
  }));

  const checkins = dbCheckins.map((c) => ({
    id: c.id,
    checkin_date: c.date.toISOString().slice(0, 10),
    fatigue: c.fatigue,
    sleep_quality: c.sleepQuality ?? c.sleep ?? 3,
    soreness: c.soreness,
    pain: c.pain,
    stress: c.stress,
    motivation: c.motivation,
    energy: c.energy ?? 3,
    injury_feeling: c.injuryFeeling ?? 1,
    wellbeing: c.wellbeing ?? 3,
    notes: c.notes
  }));

  const awards = dbAwards.map((a) => ({
    id: a.id,
    award_date: a.date.toISOString().slice(0, 10)
  }));

  const feedback = dbFeedback.map((f) => ({
    id: f.id,
    rating: f.rating,
    notes: f.notes,
    created_at: f.createdAt.toISOString()
  }));

  const evaluationValues = evaluations
    .map(evaluationAverage)
    .filter((value): value is number => value !== null);
  const avgEvaluation =
    evaluationValues.length > 0
      ? evaluationValues.reduce((sum, value) => sum + value, 0) /
        evaluationValues.length
      : null;
  const latestHealth = checkins[0] ?? null;
  const todayCheckin =
    checkins.find((checkin) => checkin.checkin_date === today) ?? null;
  const risk = latestHealth ? healthRisk(latestHealth) : null;

  const trainings = dbTrainings.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    start_time: t.startTime,
    focus: t.focus,
    goal: t.goal,
    location: t.location
  }));

  const matches = dbMatches.map((m) => ({
    id: m.id,
    date: m.date.toISOString().slice(0, 10),
    kickoff_time: m.kickoffTime,
    opponent: m.opponent,
    match_goals: m.matchGoals,
    location: m.location
  }));

  const checkinDates = Array.from(new Set(checkins.map((row) => row.checkin_date)));
  const streak = streakLength(checkinDates);
  const checkinsThisMonth = checkins.filter((row) => {
    const ageDays =
      (new Date(today).getTime() - new Date(row.checkin_date).getTime()) /
      86_400_000;
    return ageDays <= 30;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Persönlicher Bereich für Spieler. Heute fühlen, Termine sehen, Feedback empfangen."
        title="Spieler-Modus"
      />

      {isStaffPreview ? (
        <Card className="border-dashed border-emerald-300 bg-emerald-50/40">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Trainer-Vorschau
            </p>
            <form
              className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
              method="get"
            >
              <div className="flex-1 space-y-2">
                <label className="text-[13px] font-medium" htmlFor="player">
                  Spieler auswählen
                </label>
                <select
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <Button className="h-11" type="submit">
                Öffnen
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {player ? (
        <>
          {/* App-style Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-elevated sm:p-8">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl"
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">
                  {player.photo_url ? (
                    <div
                      aria-label={`Portrait von ${player.name}`}
                      className="h-full w-full bg-cover bg-center"
                      role="img"
                      style={{ backgroundImage: `url(${player.photo_url})` }}
                    />
                  ) : (
                    <UserRound aria-hidden="true" className="h-8 w-8 text-white/80" />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    Hallo
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                    {player.first_name ?? player.name}
                  </h1>
                  <p className="mt-1 text-[13px] text-slate-300">
                    {player.position ?? "Position offen"}
                    {player.team_category ? ` · ${player.team_category}` : ""}
                    {player.jersey_number ? ` · #${player.jersey_number}` : ""}
                  </p>
                </div>
              </div>
              {risk ? (
                <div className="flex flex-col items-start gap-1 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-md md:items-end">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    Letzter Check
                  </p>
                  <p className="text-[14px] font-semibold tracking-tight">
                    {risk === "red"
                      ? "🔴 Belastung prüfen"
                      : risk === "yellow"
                        ? "🟡 Aufmerksam"
                        : "🟢 Alles ok"}
                  </p>
                  <p className="text-[12px] text-slate-300">
                    {formatDate(latestHealth!.checkin_date)}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          {/* Today Check-in (zentrales Element) */}
          <PlayerModeCheckin
            alreadyDone={todayCheckin !== null}
            playerId={player.id}
            todayCheckin={todayCheckin}
          />

          {/* Streak / Stats */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-50/0">
              <CardContent className="p-4">
                <Flame
                  aria-hidden="true"
                  className="h-5 w-5 text-orange-600"
                />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                  Check-in Streak
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-orange-950">
                  {streak}
                </p>
                <p className="text-[12px] text-orange-700/80">
                  {streak === 1 ? "Tag in Folge" : "Tage in Folge"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Medal aria-hidden="true" className="h-5 w-5 text-amber-600" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Winnerpunkte
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {winnerPointTotal(points)}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {points.length} Eintr{points.length === 1 ? "ag" : "äge"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <TrendingUp
                  aria-hidden="true"
                  className="h-5 w-5 text-emerald-600"
                />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ø Bewertung
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {avgEvaluation !== null ? avgEvaluation.toFixed(1) : "–"}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  von 5
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Award aria-hidden="true" className="h-5 w-5 text-violet-600" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Auszeichnungen
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {awards.length}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {checkinsThisMonth} Check-ins / 30T
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Mein Spielplan + Feedback */}
          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays
                    aria-hidden="true"
                    className="h-4.5 w-4.5 text-primary"
                  />
                  Mein Spielplan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {[...trainings, ...matches]
                  .map((item) =>
                    "focus" in item
                      ? {
                          id: `training-${item.id}`,
                          date: item.date,
                          time: item.start_time,
                          title: item.focus,
                          location: item.location,
                          label: "Training",
                          tone:
                            "border-emerald-200 bg-emerald-50/60 text-emerald-900",
                          icon: <CalendarDays className="h-4 w-4" />
                        }
                      : {
                          id: `match-${item.id}`,
                          date: item.date,
                          time: item.kickoff_time,
                          title: `vs. ${item.opponent}`,
                          location: item.location,
                          label: "Spiel",
                          tone:
                            "border-amber-200 bg-amber-50/60 text-amber-900",
                          icon: <Trophy className="h-4 w-4" />
                        }
                  )
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .slice(0, 6)
                  .map((event) => (
                    <div
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 ${event.tone}`}
                      key={event.id}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm"
                      >
                        {event.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] opacity-70">
                          {event.label}
                        </p>
                        <p className="text-[15px] font-semibold tracking-tight">
                          {event.title}
                        </p>
                        <p className="text-[12px] opacity-80">
                          {formatDate(event.date)}
                          {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                {trainings.length === 0 && matches.length === 0 ? (
                  <EmptyState title="Aktuell keine Termine geplant." />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star
                    aria-hidden="true"
                    className="h-4.5 w-4.5 text-primary"
                  />
                  Mein Feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {evaluations.length === 0 && feedback.length === 0 ? (
                  <EmptyState title="Noch kein Feedback." />
                ) : (
                  <>
                    {evaluations.slice(0, 3).map((evaluation) => (
                      <div
                        className="rounded-2xl border border-border bg-secondary/40 p-3.5"
                        key={`eval-${evaluation.id}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="success">
                            {evaluationAverage(evaluation)?.toFixed(1) ?? "-"}/5
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(evaluation.evaluation_date)}
                          </span>
                        </div>
                        {evaluation.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-foreground/80">
                            {evaluation.notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {feedback.slice(0, 2).map((item) => (
                      <div
                        className="rounded-2xl border border-border bg-secondary/40 p-3.5"
                        key={`fb-${item.id}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="secondary">{item.rating}/10</Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(item.created_at.slice(0, 10))}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-foreground/80">
                          {item.notes}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Stärken / Ziele */}
          <section className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Meine Stärken</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">
                  {player.strengths ?? "Noch offen — fülle dein Saisonblatt aus."}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Meine Ziele</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">
                  {player.football_goals ??
                    player.development_goals ??
                    "Noch offen — fülle dein Saisonblatt aus."}
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Saisonblatt collapsible */}
          <details className="group rounded-2xl border border-border bg-card shadow-soft">
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground"
                >
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold tracking-tight">
                    Saisonblatt
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Kontaktdaten, Lieblingsteam, Ziele, Medizinisches
                  </p>
                </div>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90"
              />
            </summary>
            <div className="border-t border-border p-4 sm:p-5">
              <form action={submitPlayerSeasonForm} className="space-y-4">
                <input name="player_id" type="hidden" value={player.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    defaultValue={player.contact ?? ""}
                    name="contact"
                    placeholder="Eigener Kontakt"
                  />
                  <Input
                    defaultValue={player.parent_contact ?? ""}
                    name="parent_contact"
                    placeholder="Elternkontakt"
                  />
                  <Input
                    defaultValue={player.emergency_contact ?? ""}
                    name="emergency_contact"
                    placeholder="Notfallkontakt"
                  />
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue={player.strong_foot ?? ""}
                    name="strong_foot"
                  >
                    <option value="">Fuss offen</option>
                    <option value="left">Links</option>
                    <option value="right">Rechts</option>
                    <option value="both">Beide</option>
                  </select>
                  <Input
                    defaultValue={player.favorite_team ?? ""}
                    name="favorite_team"
                    placeholder="Lieblingsteam"
                  />
                  <Input
                    defaultValue={player.favorite_player ?? ""}
                    name="favorite_player"
                    placeholder="Lieblingsspieler"
                  />
                </div>
                <Textarea
                  defaultValue={player.football_goals ?? ""}
                  name="football_goals"
                  placeholder="Meine Fussballziele"
                />
                <Textarea
                  defaultValue={player.strengths ?? ""}
                  name="strengths"
                  placeholder="Meine Stärken"
                />
                <Textarea
                  defaultValue={player.weaknesses ?? ""}
                  name="weaknesses"
                  placeholder="Woran ich arbeiten will"
                />
                <Textarea
                  defaultValue={player.motivation ?? ""}
                  name="motivation"
                  placeholder="Was motiviert mich?"
                />
                <Textarea
                  defaultValue={player.allergies ?? ""}
                  name="allergies"
                  placeholder="Allergien"
                />
                <Textarea
                  defaultValue={player.injuries ?? ""}
                  name="injuries"
                  placeholder="Verletzungen"
                />
                <Textarea
                  defaultValue={player.limitations ?? ""}
                  name="limitations"
                  placeholder="Einschränkungen"
                />
                <Textarea
                  defaultValue={player.medications ?? ""}
                  name="medications"
                  placeholder="Medikamente"
                />
                <Button className="h-11 w-full" type="submit">
                  Saisonblatt speichern
                </Button>
              </form>
            </div>
          </details>

          {isStaffPreview ? (
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <Link href={`/players/${player.id}`}>Trainer-Portfolio öffnen</Link>
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState title="Wähle einen Spieler, um den Spieler-Modus zu öffnen." />
      )}
    </div>
  );
}
