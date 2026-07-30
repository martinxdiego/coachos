import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Award,
  CalendarDays,
  Flame,
  Inbox,
  Medal,
  TrendingUp,
  Trophy,
  UserRound,
  ShieldCheck
} from "lucide-react";
import { PublicCheckinCard } from "@/components/public-checkin-card";
import { PublicCoachInbox } from "@/components/public-coach-inbox";
import { PublicInstallPrompt } from "@/components/public-install-prompt";
import { PublicNoteToCoachCard } from "@/components/public-note-to-coach-card";
import {
  PublicSeasonForm,
  type PublicSeasonFormPlayer
} from "@/components/public-season-form";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import { PublicAvailabilityButtons } from "@/components/public-availability-buttons";
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
import {
  createSignedStorageUrl,
  PLAYER_PHOTO_BUCKET
} from "@/lib/storage";
import { formatDate, todayIsoDate } from "@/lib/utils";
import { getPlayerPortalSession } from "@/lib/player-session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    manifest: "/player/manifest",
    referrer: "no-referrer",
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "CoachOS",
    },
  };
}

function streakLength(checkinDates: string[]): number {
  if (checkinDates.length === 0) return 0;
  const seen = new Set(checkinDates);
  let streak = 0;
  const cursor = new Date(`${todayIsoDate()}T12:00:00.000Z`);
  const todayIso = cursor.toISOString().slice(0, 10);
  if (!seen.has(todayIso)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!seen.has(iso)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export default async function PlayerPublicPage() {
  const portalSession = await getPlayerPortalSession();
  if (!portalSession) {
    redirect("/player/access");
  }

  const dbPlayer = await db.player.findFirst({
    where: { id: portalSession.playerId },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      firstName: true,
      photoUrl: true,
      jerseyNumber: true,
      position: true,
      contact: true,
      parentContact: true,
      emergencyContact: true,
      strongFoot: true,
      favoriteTeam: true,
      favoritePlayer: true,
      footballGoals: true,
      strengths: true,
      weaknesses: true,
      motivation: true,
      seasonFormCompletedAt: true
    }
  });

  if (!dbPlayer) redirect("/player/access");

  const today = todayIsoDate();
  const todayDate = new Date(`${today}T00:00:00.000Z`);

  const [
    playerPhotoUrl,
    dbTeam,
    dbTrainings,
    dbMatches,
    dbCheckins,
    dbPoints,
    dbEvaluations,
    dbAwards,
    dbMessages,
    dbAvailability
  ] = await Promise.all([
    createSignedStorageUrl(
      PLAYER_PHOTO_BUCKET,
      dbPlayer.photoUrl,
      `${dbPlayer.workspaceId}/`
    ),
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
    }),
    db.availabilityResponse.findMany({
      where: {
        playerId: dbPlayer.id,
        workspaceId: dbPlayer.workspaceId
      },
      select: { eventType: true, eventId: true, status: true }
    })
  ]);
  const availabilityByEvent = new Map(
    dbAvailability.map((response) => [
      `${response.eventType}:${response.eventId}`,
      response.status
    ])
  );

  const player = {
    id: dbPlayer.id,
    name: dbPlayer.name,
    first_name: dbPlayer.firstName,
    photo_url: playerPhotoUrl,
    jersey_number: dbPlayer.jerseyNumber,
    position: dbPlayer.position,
    team_category: null
  };

  const seasonFormPlayer: PublicSeasonFormPlayer = {
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
    season_form_completed_at: dbPlayer.seasonFormCompletedAt?.toISOString() ?? null,
  };

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
  const t = await getTranslations("player");

  return (
    <div className="min-h-dvh bg-secondary/30 pb-12">
      <SwInit />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 pb-8 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-white sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+3.5rem)]">
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
            {team?.name ?? t("my_team")}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20">
              {player.photo_url ? (
                <div
                  aria-label={t("portrait_of", { name: player.name })}
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
                {t("hello", { name: player.first_name ?? player.name })}
              </h1>
              <p className="mt-1 text-[13px] text-slate-300">
                {player.position ?? t("position_open")}
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
                {t("last_check", { date: formatDate(latestHealth!.checkin_date) })}
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
          <PublicCoachInbox messages={messages} />
        ) : null}

        {/* Heute Check-in */}
        <PublicCheckinCard
          alreadyDone={todayCheckin !== null}
          todayCheckin={todayCheckin}
        />

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-50/0">
            <CardContent className="p-4">
              <Flame aria-hidden="true" className="h-5 w-5 text-orange-600" />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                {t("streak")}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-orange-950">
                {streak}
              </p>
              <p className="text-[12px] text-orange-700/80">
                {t("days_in_a_row", { count: streak })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Medal aria-hidden="true" className="h-5 w-5 text-amber-600" />
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("winnerpoints")}
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
                {t("avg_rating")}
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
                {t("awards")}
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
              {t("my_schedule")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[...trainings, ...matches]
              .map((item) =>
                "focus" in item
                  ? {
                      id: `training-${item.id}`,
                      eventId: item.id,
                      eventType: "TRAINING" as const,
                      date: item.date,
                      time: item.start_time,
                      title: item.focus,
                      location: item.location,
                      label: t("training"),
                      tone: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
                      icon: <CalendarDays className="h-4 w-4" />
                    }
                  : {
                      id: `match-${item.id}`,
                      eventId: item.id,
                      eventType: "MATCH" as const,
                      date: item.date,
                      time: item.kickoff_time,
                      title: `vs. ${item.opponent}`,
                      location: item.location,
                      label: t("match"),
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
                    <PublicAvailabilityButtons
                      eventId={event.eventId}
                      eventType={event.eventType}
                      initialStatus={
                        availabilityByEvent.get(
                          `${event.eventType}:${event.eventId}`
                        ) ?? null
                      }
                    />
                  </div>
                </div>
              ))}
            {trainings.length === 0 && matches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
                {t("no_dates")}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Push-Benachrichtigungen */}
        <PushSubscribeButton />

        {/* Notiz an Trainer */}
        <PublicNoteToCoachCard />

        {/* Saisonblatt */}
        <PublicSeasonForm player={seasonFormPlayer} />

        <Link
          className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          href="/player/security"
        >
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-700" />
          Geräte und Sicherheit verwalten
        </Link>

        <p className="pt-4 text-center text-[11px] text-muted-foreground">
          {t("footer")}
          {unreadCount > 0 ? (
            <Badge className="ml-2" variant="destructive">
              <Inbox aria-hidden="true" className="mr-1 h-3 w-3" />
              {t("unread", { count: unreadCount })}
            </Badge>
          ) : null}
        </p>
      </div>
    </div>
  );
}

