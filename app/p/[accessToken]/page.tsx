import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Award,
  CalendarDays,
  Flame,
  Inbox,
  Medal,
  TrendingUp,
  Trophy,
  UserRound
} from "lucide-react";
import { PublicCheckinCard } from "@/components/public-checkin-card";
import { PublicCoachInbox } from "@/components/public-coach-inbox";
import { PublicInstallPrompt } from "@/components/public-install-prompt";
import { PublicNoteToCoachCard } from "@/components/public-note-to-coach-card";
import { PublicSeasonForm } from "@/components/public-season-form";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import { SwInit } from "./_sw-init";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { healthRisk, evaluationAverage, winnerPointTotal } from "@/lib/coach-metrics";
import { db } from "@/lib/db";
import { formatDate, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PlayerPagePublicProps): Promise<Metadata> {
  const { accessToken } = await params;
  return {
    manifest: `/p/${accessToken}/manifest`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "CoachOS",
    },
  };
}

interface PlayerPagePublicProps {
  params: Promise<{
    accessToken: string;
  }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function streakLength(checkinDates: string[]): number {
  if (checkinDates.length === 0) return 0;
  const seen = new Set(checkinDates);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
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

export default async function PlayerPublicPage({ params }: PlayerPagePublicProps) {
  const { accessToken } = await params;
  if (!UUID_RE.test(accessToken)) {
    notFound();
  }

  const dbPlayer = await db.player.findFirst({
    where: { accessToken }
  });

  if (!dbPlayer) {
    notFound();
  }

  const today = todayIsoDate();
  const todayDate = new Date(`${today}T00:00:00.000Z`);

  const [
    dbTeam,
    dbTrainings,
    dbMatches,
    dbCheckins,
    dbPoints,
    dbEvaluations,
    dbAwards,
    dbMessages
  ] = await Promise.all([
    db.workspace.findUnique({
      where: { id: dbPlayer.workspaceId },
      select: { id: true, name: true, ageGroup: true, season: true }
    }),
    db.training.findMany({
      where: {
        workspaceId: dbPlayer.workspaceId,
        date: { gte: todayDate }
      },
      orderBy: { date: "asc" },
      take: 6
    }),
    db.match.findMany({
      where: {
        workspaceId: dbPlayer.workspaceId,
        date: { gte: todayDate }
      },
      orderBy: { date: "asc" },
      take: 6
    }),
    db.healthCheck.findMany({
      where: { playerId: dbPlayer.id },
      orderBy: { date: "desc" },
      take: 60
    }),
    db.winnerPoint.findMany({
      where: { playerId: dbPlayer.id },
      orderBy: { awardedAt: "desc" },
      take: 30
    }),
    db.rating.findMany({
      where: { playerId: dbPlayer.id },
      orderBy: { date: "desc" },
      take: 20
    }),
    db.award.findMany({
      where: { playerId: dbPlayer.id },
      orderBy: { date: "desc" },
      take: 10
    }),
    db.coachMessage.findMany({
      where: { playerId: dbPlayer.id },
      orderBy: { createdAt: "desc" },
      take: 40
    })
  ]);

  const player = {
    ...dbPlayer,
    first_name: dbPlayer.firstName,
    last_name: dbPlayer.lastName,
    photo_url: dbPlayer.photoUrl,
    jersey_number: dbPlayer.jerseyNumber,
    birth_date: dbPlayer.birthDate?.toISOString().slice(0, 10) ?? null,
    birth_year: dbPlayer.birthYear,
    height_cm: dbPlayer.height,
    weight_kg: dbPlayer.weight,
    preferred_foot: dbPlayer.strongFoot,
    strong_foot: dbPlayer.strongFoot,
    favorite_team: dbPlayer.favoriteTeam,
    favorite_player: dbPlayer.favoritePlayer,
    football_goals: dbPlayer.footballGoals,
    motivation: dbPlayer.motivation,
    allergies: dbPlayer.allergies,
    injuries: dbPlayer.injuries,
    limitations: dbPlayer.limitations,
    medications: dbPlayer.medications,
    coach_alerts: dbPlayer.coachAlerts,
    season_form_completed_at: dbPlayer.seasonFormCompletedAt?.toISOString() ?? null,
    parent_contact: dbPlayer.parentContact,
    emergency_contact: dbPlayer.emergencyContact,
  } as any;

  const team = dbTeam ? {
    id: dbTeam.id,
    name: dbTeam.name,
    age_group: dbTeam.ageGroup,
    season: dbTeam.season
  } : null;

  const trainings = dbTrainings.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    start_time: t.startTime,
    focus: t.focus,
    goal: t.goal,
    location: t.location,
    team_id: t.workspaceId
  }));

  const matches = dbMatches.map((m) => ({
    id: m.id,
    date: m.date.toISOString().slice(0, 10),
    kickoff_time: m.kickoffTime,
    opponent: m.opponent,
    location: m.location,
    match_goals: m.matchGoals,
    team_id: m.workspaceId
  }));

  const checkins = dbCheckins.map((c) => ({
    id: c.id,
    player_id: c.playerId,
    checkin_date: c.date.toISOString().slice(0, 10),
    context_type: c.contextType,
    fatigue: c.fatigue,
    sleep: c.sleep,
    sleep_quality: c.sleepQuality ?? 3,
    soreness: c.soreness,
    pain: c.pain,
    stress: c.stress,
    motivation: c.motivation,
    energy: c.energy ?? 3,
    injury_feeling: c.injuryFeeling ?? 3,
    wellbeing: c.wellbeing ?? 3,
    notes: c.notes,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString()
  }));

  const points = dbPoints.map((p) => ({
    id: p.id,
    workspace_id: p.workspaceId,
    player_id: p.playerId,
    date: p.date.toISOString().slice(0, 10),
    context: p.context,
    context_type: p.contextType,
    context_id: p.contextId,
    context_label: p.contextLabel,
    points: p.points,
    reason: p.reason,
    awarded_at: p.awardedAt.toISOString(),
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString()
  }));

  const evaluations = dbEvaluations.map((e) => ({
    id: e.id,
    player_id: e.playerId,
    rater_id: e.raterId,
    evaluation_date: e.date.toISOString().slice(0, 10),
    context: e.context,
    context_type: e.contextType,
    context_id: e.contextId,
    context_label: e.contextLabel,
    participation: e.participation,
    motivation: e.motivation,
    training_quality: e.trainingQuality,
    playing_quality: e.playingQuality,
    match_quality: e.matchQuality,
    behaviour: e.behavior,
    behavior: e.behavior,
    effort: e.effort,
    concentration: e.concentration,
    average: e.average,
    comment: e.comment,
    notes: e.notes,
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString()
  }));

  const awards = dbAwards.map((a) => ({
    id: a.id,
    workspace_id: a.workspaceId,
    player_id: a.playerId,
    previous_player_id: a.previousPlayerId,
    match_id: a.matchId,
    event_label: a.eventLabel,
    date: a.date.toISOString().slice(0, 10),
    event: a.event,
    reason: a.reason,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString()
  }));

  const messages = dbMessages.map((m) => ({
    id: m.id,
    team_id: m.workspaceId,
    created_by: m.userId,
    player_id: m.playerId,
    category: m.category,
    body: m.body,
    read_at: m.readAt ? m.readAt.toISOString() : null,
    created_at: m.createdAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
    title: null
  }));

  const todayCheckin =
    checkins.find((checkin) => checkin.checkin_date === today) ?? null;
  const latestHealth = checkins[0] ?? null;
  const risk = latestHealth ? healthRisk(latestHealth) : null;
  const evaluationValues = evaluations
    .map(evaluationAverage)
    .filter((value): value is number => value !== null);
  const avgEvaluation =
    evaluationValues.length > 0
      ? evaluationValues.reduce((sum, value) => sum + value, 0) /
        evaluationValues.length
      : null;
  const checkinDates = Array.from(new Set(checkins.map((row) => row.checkin_date)));
  const streak = streakLength(checkinDates);
  const unreadCount = messages.filter((msg) => !msg.read_at).length;

  return (
    <div className="min-h-dvh bg-secondary/30 pb-12">
      <SwInit />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 pb-8 pt-10 text-white sm:px-6 sm:pt-14">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {team?.name ?? "Mein Team"}
          </p>
          <div className="mt-3 flex items-center gap-4">
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
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Hallo {player.first_name ?? player.name}
              </h1>
              <p className="mt-1 text-[13px] text-slate-300">
                {player.position ?? "Position offen"}
                {player.team_category ? ` · ${player.team_category}` : ""}
                {player.jersey_number ? ` · #${player.jersey_number}` : ""}
              </p>
            </div>
          </div>
          {risk ? (
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 ring-1 ring-white/20 backdrop-blur-md">
              <span aria-hidden="true">
                {risk === "red" ? "🔴" : risk === "yellow" ? "🟡" : "🟢"}
              </span>
              <span className="text-[13px] font-medium">
                Letzter Check · {formatDate(latestHealth!.checkin_date)}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6 sm:px-6">
        {/* Install Banner */}
        <PublicInstallPrompt />

        {/* Coach Inbox */}
        {messages.length > 0 ? (
          <PublicCoachInbox accessToken={accessToken} messages={messages} />
        ) : null}

        {/* Heute Check-in */}
        <PublicCheckinCard
          accessToken={accessToken}
          alreadyDone={todayCheckin !== null}
          todayCheckin={todayCheckin}
        />

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-50/0">
            <CardContent className="p-4">
              <Flame aria-hidden="true" className="h-5 w-5 text-orange-600" />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                Streak
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-orange-950">
                {streak}
              </p>
              <p className="text-[12px] text-orange-700/80">
                {streak === 1 ? "Tag" : "Tage"} in Folge
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
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <TrendingUp aria-hidden="true" className="h-5 w-5 text-emerald-600" />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ø Bewertung
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {avgEvaluation !== null ? avgEvaluation.toFixed(1) : "–"}
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
            </CardContent>
          </Card>
        </section>

        {/* Spielplan */}
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
                      tone: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
                      icon: <CalendarDays className="h-4 w-4" />
                    }
                  : {
                      id: `match-${item.id}`,
                      date: item.date,
                      time: item.kickoff_time,
                      title: `vs. ${item.opponent}`,
                      location: item.location,
                      label: "Spiel",
                      tone: "border-amber-200 bg-amber-50/60 text-amber-900",
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
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
                Aktuell keine Termine geplant.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Push-Benachrichtigungen */}
        <PushSubscribeButton
          playerId={player.id}
          playerUrl={`/p/${accessToken}`}
        />

        {/* Notiz an Trainer */}
        <PublicNoteToCoachCard accessToken={accessToken} />

        {/* Saisonblatt */}
        <PublicSeasonForm accessToken={accessToken} player={player} />

        <p className="pt-4 text-center text-[11px] text-muted-foreground">
          Persönlicher Spieler-Bereich · CoachOS
          {unreadCount > 0 ? (
            <Badge className="ml-2" variant="destructive">
              <Inbox aria-hidden="true" className="mr-1 h-3 w-3" />
              {unreadCount} ungelesen
            </Badge>
          ) : null}
        </p>
      </div>
    </div>
  );
}

