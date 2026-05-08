import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Shield,
  Trophy,
  UsersRound
} from "lucide-react";
import { toggleTask } from "@/app/actions";
import { DashboardOnboarding } from "@/components/dashboard-onboarding";
import { DashboardQuickActions } from "@/components/dashboard-quick-actions";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { healthRisk } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Team } from "@/lib/types";
import { formatDate, formatDateTime, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function germanGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Hallo";
  if (hour < 22) return "Guten Abend";
  return "Gute Nacht";
}

function germanLongDate(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${iso}T00:00:00`));
}

function MetricCard({
  label,
  value,
  icon
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground/70">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

async function HeroFocus({ teamId }: { teamId: string }) {
  const supabase = await createClient();
  const today = todayIsoDate();
  const [trainingResult, matchResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id,date,start_time,focus")
      .eq("team_id", teamId)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,formation")
      .eq("team_id", teamId)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  const training = trainingResult.data;
  const match = matchResult.data;

  const todayTraining = training && training.date === today ? training : null;
  const todayMatch = match && match.date === today ? match : null;

  if (todayTraining || todayMatch) {
    return (
      <div className="mt-6 flex flex-wrap gap-2">
        {todayTraining ? (
          <Link
            className="inline-flex items-center gap-3 rounded-2xl bg-emerald-500/15 px-4 py-3 ring-1 ring-emerald-300/30 backdrop-blur-md transition hover:bg-emerald-500/25"
            href="/trainings"
          >
            <span className="rounded-full bg-emerald-400/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Heute Training
            </span>
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold tracking-tight">
                {todayTraining.focus}
              </span>
              {todayTraining.start_time ? (
                <span className="block text-[12px] text-emerald-100/80">
                  {todayTraining.start_time.slice(0, 5)} Uhr
                </span>
              ) : null}
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 text-emerald-100" />
          </Link>
        ) : null}
        {todayMatch ? (
          <Link
            className="inline-flex items-center gap-3 rounded-2xl bg-amber-500/15 px-4 py-3 ring-1 ring-amber-300/30 backdrop-blur-md transition hover:bg-amber-500/25"
            href="/matches"
          >
            <span className="rounded-full bg-amber-400/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
              Heute Spiel
            </span>
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold tracking-tight">
                vs. {todayMatch.opponent}
              </span>
              {todayMatch.kickoff_time ? (
                <span className="block text-[12px] text-amber-100/80">
                  Anpfiff {todayMatch.kickoff_time.slice(0, 5)} Uhr
                </span>
              ) : null}
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 text-amber-100" />
          </Link>
        ) : null}
      </div>
    );
  }

  const focus = training
    ? {
        kind: "Training",
        title: training.focus,
        subtitle: `${formatDate(training.date)}${
          training.start_time ? ` · ${training.start_time.slice(0, 5)}` : ""
        }`,
        href: "/trainings"
      }
    : match
    ? {
        kind: "Spiel",
        title: `vs. ${match.opponent}`,
        subtitle: `${formatDate(match.date)}${
          match.kickoff_time ? ` · ${match.kickoff_time.slice(0, 5)}` : ""
        }${match.formation ? ` · ${match.formation}` : ""}`,
        href: "/matches"
      }
    : null;

  if (!focus) {
    return (
      <p className="mt-6 text-[14px] text-slate-300">
        Plane deine Woche — Training, Spieltag, Material und Taktik an einem
        Ort.
      </p>
    );
  }

  return (
    <Link
      className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md ring-1 ring-white/15 transition hover:bg-white/15"
      href={focus.href}
    >
      <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
        Nächstes {focus.kind}
      </span>
      <span>
        <span className="block text-[15px] font-semibold tracking-tight">
          {focus.title}
        </span>
        <span className="block text-[12px] text-slate-300">
          {focus.subtitle}
        </span>
      </span>
      <ArrowRight aria-hidden="true" className="h-4 w-4 text-slate-300" />
    </Link>
  );
}

function HeroFocusSkeleton() {
  return (
    <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
      <Skeleton className="h-5 w-28 rounded-full bg-white/20" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40 bg-white/20" />
        <Skeleton className="h-3 w-32 bg-white/15" />
      </div>
    </div>
  );
}

function Hero({ team }: { team: Team }) {
  const today = todayIsoDate();
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-7 text-white shadow-elevated sm:p-10">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-emerald-300">
            {germanGreeting()}, Coach
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {team.name}
          </h1>
          <p className="mt-2 text-[14px] text-slate-300">
            {germanLongDate(today)} · {team.season ?? "Aktuelle Saison"}
            {team.age_group ? ` · ${team.age_group}` : ""}
          </p>

          <Suspense fallback={<HeroFocusSkeleton />}>
            <HeroFocus teamId={team.id} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function DashboardSectionsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton className="h-[88px] rounded-2xl" key={i} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-9 w-44 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function DashboardSections({ teamId }: { teamId: string }) {
  const supabase = await createClient();
  const today = todayIsoDate();

  const [
    playersResult,
    nextTrainingResult,
    nextMatchResult,
    trainingsResult,
    matchesResult,
    materialsResult,
    boardsResult,
    tasksResult,
    healthResult
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position,status,rating,jersey_number,birth_year")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_sessions")
      .select("id,date,start_time,duration_minutes,focus,goal,location,intensity")
      .eq("team_id", teamId)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,location,home_away,formation,result")
      .eq("team_id", teamId)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("training_sessions")
      .select("id,date,focus,intensity,created_at")
      .eq("team_id", teamId)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("matches")
      .select("id,date,opponent,result,formation,created_at")
      .eq("team_id", teamId)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("materials")
      .select("id,title,type,created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tactic_boards")
      .select("id,title,created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("tasks")
      .select("id,title,status,due_date,created_at")
      .eq("team_id", teamId)
      .order("status", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("health_checkins")
      .select("player_id,checkin_date,fatigue,sleep_quality,soreness,pain,stress,motivation,energy,injury_feeling,wellbeing")
      .eq("team_id", teamId)
      .order("checkin_date", { ascending: false })
      .limit(200)
  ]);

  for (const result of [
    playersResult,
    nextTrainingResult,
    nextMatchResult,
    trainingsResult,
    matchesResult,
    materialsResult,
    boardsResult,
    tasksResult,
    healthResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const players = playersResult.data ?? [];
  const trainings = trainingsResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const materials = materialsResult.data ?? [];
  const boards = boardsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const healthCheckins = healthResult.data ?? [];

  const latestCheckinsByPlayer = new Map<string, (typeof healthCheckins)[number]>();
  for (const checkin of healthCheckins) {
    if (!latestCheckinsByPlayer.has(checkin.player_id)) {
      latestCheckinsByPlayer.set(checkin.player_id, checkin);
    }
  }
  const wellnessAlerts = players
    .map((player) => {
      const latest = latestCheckinsByPlayer.get(player.id);
      if (!latest) return null;
      const risk = healthRisk(latest);
      if (risk !== "red") return null;
      return { player, checkin: latest, risk };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const checkinPlayers = players.map((player) => ({
    id: player.id,
    name: player.name
  }));
  const recentActivity = [
    ...trainings.map((item) => ({
      id: `training-${item.id}`,
      label: "Training",
      title: item.focus,
      createdAt: item.created_at
    })),
    ...matches.map((item) => ({
      id: `match-${item.id}`,
      label: "Spiel",
      title: item.opponent,
      createdAt: item.created_at
    })),
    ...materials.map((item) => ({
      id: `material-${item.id}`,
      label: "Material",
      title: item.title,
      createdAt: item.created_at
    })),
    ...boards.map((item) => ({
      id: `board-${item.id}`,
      label: "Taktik",
      title: item.title,
      createdAt: item.created_at
    }))
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 6);

  const nextTraining = nextTrainingResult.data;
  const nextMatch = nextMatchResult.data;
  const openTasks = tasks.filter((task) => task.status === "open");
  const playersWithoutNumbers = players.filter(
    (player) => !player.jersey_number
  ).length;
  const playersWithoutBirthYear = players.filter(
    (player) => !player.birth_year
  ).length;
  const injuredPlayers = players.filter(
    (player) => player.status === "injured"
  );
  const limitedPlayersList = players.filter(
    (player) => player.status === "limited"
  );
  const availablePlayers = players.length - injuredPlayers.length - limitedPlayersList.length;
  const limitedPlayers = injuredPlayers.length + limitedPlayersList.length;
  const coachHints = [
    players.length === 0
      ? {
          href: "/players",
          label: "Kader",
          title: "Noch keine Spieler erfasst",
          body: "Importiere oder erstelle zuerst deinen Kader, damit Training, Material und Taktik sinnvoll arbeiten."
        }
      : null,
    playersWithoutNumbers > 0
      ? {
          href: "/players",
          label: "Spieler",
          title: `${playersWithoutNumbers} Spieler ohne Rückennummer`,
          body: "Rückennummern machen Matchday, Materiallisten und Taktikboard deutlich schneller lesbar."
        }
      : null,
    playersWithoutBirthYear > 0
      ? {
          href: "/players",
          label: "Profil",
          title: `${playersWithoutBirthYear} Spieler ohne Jahrgang`,
          body: "Jahrgänge helfen dir bei Altersstufe, Belastung und Entwicklungsplanung."
        }
      : null,
    nextTraining && !nextTraining.goal
      ? {
          href: "/trainings",
          label: "Training",
          title: "Nächstes Training ohne Ziel",
          body: "Ergänze ein klares Trainingsziel, damit Phasen und Coachingpunkte zusammenpassen."
        }
      : null,
    nextMatch && !nextMatch.formation
      ? {
          href: "/matches",
          label: "Spiel",
          title: "Nächstes Spiel ohne Formation",
          body: "Setze Formation und Startelf, damit der Matchday-Modus wirklich hilft."
        }
      : null,
    limitedPlayers > 0
      ? {
          href: "/players",
          label: "Belastung",
          title: `${limitedPlayers} Spieler mit Einschränkung`,
          body: "Prüfe Belastung, Rollen und Einsatzzeit vor Training oder Spiel."
        }
      : null
  ].filter((hint): hint is NonNullable<typeof hint> => hint !== null);

  return (
    <>
      {/* Onboarding-Tour (einmalig) */}
      <DashboardOnboarding />

      {/* Wellness-Alert Banner */}
      {wellnessAlerts.length > 0 ? (
        <section
          aria-label="Wellness-Warnung"
          className="rounded-2xl border border-red-300 bg-gradient-to-br from-red-50 via-red-50/70 to-red-50 p-5 shadow-soft"
        >
          <div className="flex flex-wrap items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm"
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">
                Belastung kritisch
              </p>
              <p className="mt-0.5 text-[16px] font-semibold tracking-tight text-red-950">
                {wellnessAlerts.length === 1
                  ? "1 Spieler braucht Aufmerksamkeit vor dem Training"
                  : `${wellnessAlerts.length} Spieler brauchen Aufmerksamkeit vor dem Training`}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {wellnessAlerts.slice(0, 6).map(({ player, checkin }) => (
                  <li key={player.id}>
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-white/80 px-3 py-1 text-[12px] font-medium text-red-900 ring-1 ring-red-200 transition hover:bg-white"
                      href={`/players/${player.id}`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-red-600"
                      />
                      {player.name}
                      <span className="text-red-600">
                        S {checkin.pain}/5 · E {checkin.energy}/5
                      </span>
                    </Link>
                  </li>
                ))}
                {wellnessAlerts.length > 6 ? (
                  <li className="inline-flex items-center px-2 text-[12px] text-red-700">
                    +{wellnessAlerts.length - 6} weitere
                  </li>
                ) : null}
              </ul>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/health">
                Belastung öffnen
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Quick Actions */}
      <DashboardQuickActions players={checkinPlayers} />

      {/* Metrics */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Spieler"
          value={players.length}
          icon={<UsersRound className="h-4.5 w-4.5" />}
        />
        <MetricCard
          label="Offene Aufgaben"
          value={openTasks.length}
          icon={<ClipboardList className="h-4.5 w-4.5" />}
        />
        <MetricCard
          label="Materialien"
          value={materials.length}
          icon={<FileText className="h-4.5 w-4.5" />}
        />
        <MetricCard
          label="Taktikboards"
          value={boards.length}
          icon={<Shield className="h-4.5 w-4.5" />}
        />
      </section>

      {/* Nächstes Training / Spiel */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Nächstes Training</CardTitle>
              {nextTraining?.intensity ? (
                <Badge variant="success">{nextTraining.intensity}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {nextTraining ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-secondary/60 p-4">
                  <p className="text-[15px] font-semibold tracking-tight">
                    {nextTraining.focus}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {formatDate(nextTraining.date)}
                    {nextTraining.start_time
                      ? ` · ${nextTraining.start_time.slice(0, 5)}`
                      : ""}
                    {nextTraining.location ? ` · ${nextTraining.location}` : ""}
                  </p>
                  <p className="mt-3 text-[13px] leading-6 text-foreground/80">
                    {nextTraining.goal ?? "Noch kein Trainingsziel hinterlegt."}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/trainings">
                    Trainingsplan öffnen
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                action={
                  <Button asChild size="sm">
                    <Link href="/trainings">Training erstellen</Link>
                  </Button>
                }
                body="Erstelle einen Plan mit Phasen, Material und Coachingpunkten."
                icon={ClipboardList}
                title="Noch kein Training geplant."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nächstes Spiel</CardTitle>
          </CardHeader>
          <CardContent>
            {nextMatch ? (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-4 text-white">
                  <div
                    aria-hidden="true"
                    className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl"
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300">
                        Gegner
                      </p>
                      <p className="mt-1 text-xl font-semibold tracking-tight">
                        {nextMatch.opponent}
                      </p>
                    </div>
                    <Trophy
                      aria-hidden="true"
                      className="h-5 w-5 text-emerald-300"
                    />
                  </div>
                  <p className="relative mt-3 text-[13px] text-slate-300">
                    {formatDate(nextMatch.date)}
                    {nextMatch.kickoff_time
                      ? ` · ${nextMatch.kickoff_time.slice(0, 5)}`
                      : ""}
                    {nextMatch.formation ? ` · ${nextMatch.formation}` : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/matches">
                    Spielplanung öffnen
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                action={
                  <Button asChild size="sm">
                    <Link href="/matches">Matchday planen</Link>
                  </Button>
                }
                body="Plane Gegner, Treffpunkt, Aufgebot, Formation und Matchziele."
                icon={Trophy}
                title="Noch kein Spiel geplant."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Spielerstatus & Aufgaben */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Spielerstatus</CardTitle>
              <Link
                className="text-[12px] font-medium text-primary hover:underline"
                href="/players"
              >
                Kader öffnen
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {players.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-3 text-emerald-900">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em]">
                      Verfügbar
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {availablePlayers}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-3 text-amber-900">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em]">
                      Eingeschränkt
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {limitedPlayersList.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-red-200/60 bg-red-50/70 p-3 text-red-900">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em]">
                      Verletzt
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {injuredPlayers.length}
                    </p>
                  </div>
                </div>
                {injuredPlayers.length + limitedPlayersList.length > 0 ? (
                  <ul className="space-y-1.5">
                    {[...injuredPlayers, ...limitedPlayersList]
                      .slice(0, 4)
                      .map((player) => (
                        <li
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-[13px]"
                          key={player.id}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span
                              aria-hidden="true"
                              className={
                                player.status === "injured"
                                  ? "h-2 w-2 rounded-full bg-red-500"
                                  : "h-2 w-2 rounded-full bg-amber-500"
                              }
                            />
                            <span className="truncate font-medium">
                              {player.name}
                            </span>
                          </span>
                          <Badge variant="secondary">
                            {player.status === "injured"
                              ? "Verletzt"
                              : "Eingeschränkt"}
                          </Badge>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    Alle Spieler aktuell einsatzbereit.
                  </p>
                )}
              </div>
            ) : (
              <EmptyState
                action={
                  <Button asChild size="sm">
                    <Link href="/players">Spieler anlegen</Link>
                  </Button>
                }
                body="Erfasse zuerst deinen Kader, damit Status und Belastung sichtbar werden."
                icon={HeartPulse}
                title="Noch kein Kader."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Offene Aufgaben</CardTitle>
              <Badge variant="secondary">{openTasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <form
                  action={toggleTask}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 px-3.5 py-3 transition-colors hover:bg-secondary/60"
                  key={task.id}
                >
                  <input name="id" type="hidden" value={task.id} />
                  <input name="status" type="hidden" value={task.status} />
                  <div className="min-w-0">
                    <p
                      className={`text-[14px] font-medium tracking-tight ${
                        task.status === "done"
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {task.due_date ? formatDate(task.due_date) : "Ohne Datum"}
                    </p>
                  </div>
                  <Button
                    className="shrink-0"
                    size="sm"
                    type="submit"
                    variant={task.status === "done" ? "secondary" : "outline"}
                  >
                    {task.status === "done" ? "Erledigt" : "Offen"}
                  </Button>
                </form>
              ))
            ) : (
              <EmptyState
                body="Erstelle Aufgaben über das + unten rechts."
                icon={ClipboardList}
                title="Keine offenen Aufgaben."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Trainer-Hinweise */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Trainer-Hinweise
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Was du als Nächstes sauber machen solltest.
            </p>
          </div>
          <Badge variant={coachHints.length > 0 ? "secondary" : "success"}>
            {coachHints.length > 0
              ? `${coachHints.length} offen`
              : "Alles bereit"}
          </Badge>
        </div>
        {coachHints.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {coachHints.slice(0, 6).map((hint) => (
              <Link
                className="group rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
                href={hint.href}
                key={hint.title}
              >
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="secondary">{hint.label}</Badge>
                  <AlertCircle
                    aria-hidden="true"
                    className="h-4 w-4 text-primary opacity-70 transition group-hover:opacity-100"
                  />
                </div>
                <p className="mt-3 text-[15px] font-semibold tracking-tight">
                  {hint.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
                  {hint.body}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-emerald-900">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            <p className="text-[14px] font-medium">
              Kader, nächste Termine und Kernplanung sehen vollständig aus.
            </p>
          </div>
        )}
      </section>

      {/* Letzte Aktivitäten */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 px-3.5 py-3"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.label}</Badge>
                      <p className="truncate text-[14px] font-medium tracking-tight">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <CalendarCheck
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </div>
              ))
            ) : (
              <EmptyState title="Noch keine Aktivität." />
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default async function DashboardPage() {
  const { team } = await requireActiveTeam();

  return (
    <div className="space-y-8">
      <Hero team={team} />
      <Suspense fallback={<DashboardSectionsSkeleton />}>
        <DashboardSections teamId={team.id} />
      </Suspense>
    </div>
  );
}
