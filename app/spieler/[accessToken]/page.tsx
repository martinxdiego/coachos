import { notFound } from "next/navigation";
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
import { PublicNoteToCoachCard } from "@/components/public-note-to-coach-card";
import { PublicSeasonForm } from "@/components/public-season-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { healthRisk, evaluationAverage, winnerPointTotal } from "@/lib/coach-metrics";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  const admin = createAdminClient();
  const { data: player } = await admin
    .from("players")
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();

  if (!player) {
    notFound();
  }

  const today = todayIsoDate();

  const [
    teamResult,
    trainingsResult,
    matchesResult,
    checkinsResult,
    pointsResult,
    evaluationsResult,
    awardsResult,
    messagesResult
  ] = await Promise.all([
    admin
      .from("teams")
      .select("id,name,age_group,season")
      .eq("id", player.team_id)
      .maybeSingle(),
    admin
      .from("training_sessions")
      .select("id,date,start_time,focus,goal,location")
      .eq("team_id", player.team_id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(6),
    admin
      .from("matches")
      .select("id,date,kickoff_time,opponent,location,match_goals")
      .eq("team_id", player.team_id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(6),
    admin
      .from("health_checkins")
      .select("*")
      .eq("player_id", player.id)
      .order("checkin_date", { ascending: false })
      .limit(60),
    admin
      .from("winner_points")
      .select("*")
      .eq("player_id", player.id)
      .order("awarded_at", { ascending: false })
      .limit(30),
    admin
      .from("player_evaluations")
      .select("*")
      .eq("player_id", player.id)
      .order("evaluation_date", { ascending: false })
      .limit(20),
    admin
      .from("player_awards")
      .select("*")
      .eq("player_id", player.id)
      .order("award_date", { ascending: false })
      .limit(10),
    admin
      .from("coach_messages")
      .select("*")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(40)
  ]);

  const team = teamResult.data;
  const trainings = trainingsResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const checkins = checkinsResult.data ?? [];
  const points = pointsResult.data ?? [];
  const evaluations = evaluationsResult.data ?? [];
  const awards = awardsResult.data ?? [];
  const messages = messagesResult.data ?? [];

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

