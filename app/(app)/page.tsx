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
import { DashboardDetails } from "@/components/dashboard-details";
import { DashboardQuickActions } from "@/components/dashboard-quick-actions";
import {
  DashboardAbsenceOverview,
  DashboardAbsenceOverviewSkeleton
} from "@/components/dashboard-absence-overview";
import { FirstRunChecklist } from "@/components/first-run-checklist";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { healthRisk } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Workspace } from "@prisma/client";
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
  const today = todayIsoDate();
  const startOfToday = new Date(`${today}T00:00:00.000Z`);

  const [training, match] = await Promise.all([
    db.training.findFirst({
      where: {
        workspaceId: teamId,
        date: { gte: startOfToday },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        focus: true,
      },
      orderBy: {
        date: "asc",
      },
    }),
    db.match.findFirst({
      where: {
        workspaceId: teamId,
        date: { gte: startOfToday },
      },
      select: {
        id: true,
        date: true,
        kickoffTime: true,
        opponent: true,
        formation: true,
      },
      orderBy: {
        date: "asc",
      },
    }),
  ]);

  const todayTraining = training && training.date.toISOString().slice(0, 10) === today ? {
    ...training,
    date: training.date.toISOString().slice(0, 10),
    start_time: training.startTime,
  } : null;

  const todayMatch = match && match.date.toISOString().slice(0, 10) === today ? {
    ...match,
    date: match.date.toISOString().slice(0, 10),
    kickoff_time: match.kickoffTime,
  } : null;

  const nextTraining = training ? {
    ...training,
    date: training.date.toISOString().slice(0, 10),
    start_time: training.startTime,
  } : null;

  const nextMatch = match ? {
    ...match,
    date: match.date.toISOString().slice(0, 10),
    kickoff_time: match.kickoffTime,
  } : null;



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

  const focus = nextTraining
    ? {
        kind: "Training",
        title: nextTraining.focus,
        subtitle: `${formatDate(nextTraining.date)}${
          nextTraining.start_time ? ` · ${nextTraining.start_time.slice(0, 5)}` : ""
        }`,
        href: "/trainings"
      }
    : nextMatch
    ? {
        kind: "Spiel",
        title: `vs. ${nextMatch.opponent}`,
        subtitle: `${formatDate(nextMatch.date)}${
          nextMatch.kickoff_time ? ` · ${nextMatch.kickoff_time.slice(0, 5)}` : ""
        }${nextMatch.formation ? ` · ${nextMatch.formation}` : ""}`,
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

function Hero({ team }: { team: Workspace }) {
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
            {team.ageGroup ? ` · ${team.ageGroup}` : ""}
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

async function DashboardSections({ team }: { team: Workspace }) {
  const teamId = team.id;
  const today = todayIsoDate();
  const startOfToday = new Date(`${today}T00:00:00.000Z`);

  const [
    dbPlayers,
    nextTraining,
    nextMatch,
    dbTrainings,
    dbMatches,
    dbMaterials,
    dbBoards,
    dbTasks,
    dbHealth,
    dbFeedback
  ] = await Promise.all([
    db.player.findMany({
      where: { workspaceId: teamId },
      select: {
        id: true,
        name: true,
        position: true,
        status: true,
        rating: true,
        jerseyNumber: true,
        birthYear: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.training.findFirst({
      where: {
        workspaceId: teamId,
        date: { gte: startOfToday },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        durationMinutes: true,
        focus: true,
        goal: true,
        location: true,
        intensity: true,
      },
      orderBy: { date: "asc" },
    }),
    db.match.findFirst({
      where: {
        workspaceId: teamId,
        date: { gte: startOfToday },
      },
      select: {
        id: true,
        date: true,
        kickoffTime: true,
        opponent: true,
        location: true,
        homeAway: true,
        formation: true,
        result: true,
      },
      orderBy: { date: "asc" },
    }),
    db.training.findMany({
      where: { workspaceId: teamId },
      select: {
        id: true,
        date: true,
        focus: true,
        intensity: true,
        createdAt: true,
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
    db.match.findMany({
      where: { workspaceId: teamId },
      select: {
        id: true,
        date: true,
        opponent: true,
        result: true,
        formation: true,
        createdAt: true,
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
    db.material.findMany({
      where: { workspaceId: teamId },
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.tacticBoard.findMany({
      where: { workspaceId: teamId },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.task.findMany({
      where: { workspaceId: teamId },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        createdAt: true,
      },
      orderBy: [
        { status: "desc" },
        { dueDate: "asc" },
      ],
      take: 6,
    }),
    db.healthCheck.findMany({
      where: {
        player: {
          workspaceId: teamId,
        },
      },
      select: {
        playerId: true,
        date: true,
        fatigue: true,
        sleepQuality: true,
        soreness: true,
        pain: true,
        stress: true,
        motivation: true,
        energy: true,
        injuryFeeling: true,
        wellbeing: true,
      },
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.playerFeedback.findMany({
      where: {
        workspaceId: teamId,
        createdAt: {
          gte: new Date(Date.now() - 48 * 3600000),
        },
      },
      select: {
        id: true,
        playerId: true,
        rating: true,
        notes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const players = dbPlayers.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    status: p.status.toLowerCase(),
    rating: p.rating,
    jersey_number: p.jerseyNumber,
    birth_year: p.birthYear,
    created_at: p.createdAt.toISOString(),
  }));

  const trainings = dbTrainings.map(t => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    focus: t.focus,
    intensity: t.intensity,
    created_at: t.createdAt.toISOString(),
  }));

  const matches = dbMatches.map(m => ({
    id: m.id,
    date: m.date.toISOString().slice(0, 10),
    opponent: m.opponent,
    result: m.result,
    formation: m.formation,
    created_at: m.createdAt.toISOString(),
  }));

  const materials = dbMaterials.map(m => ({
    id: m.id,
    title: m.title,
    type: m.type,
    created_at: m.createdAt.toISOString(),
  }));

  const boards = dbBoards.map(b => ({
    id: b.id,
    title: b.title,
    created_at: b.createdAt.toISOString(),
  }));

  const tasks = dbTasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status === "done" ? "done" : "open",
    due_date: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    created_at: t.createdAt.toISOString(),
  }));

  const healthCheckins = dbHealth.map(h => ({
    player_id: h.playerId,
    checkin_date: h.date.toISOString().slice(0, 10),
    fatigue: h.fatigue,
    sleep_quality: h.sleepQuality ?? 3,
    soreness: h.soreness,
    pain: h.pain,
    stress: h.stress,
    motivation: h.motivation,
    energy: h.energy ?? 3,
    injury_feeling: h.injuryFeeling ?? 1,
    wellbeing: h.wellbeing ?? 3,
  }));

  const recentFeedback = dbFeedback.map(f => ({
    id: f.id,
    player_id: f.playerId,
    rating: f.rating,
    notes: f.notes,
    created_at: f.createdAt.toISOString(),
  }));

  const latestCheckinsByPlayer = new Map<string, (typeof healthCheckins)[number]>();
  for (const checkin of healthCheckins) {
    if (!latestCheckinsByPlayer.has(checkin.player_id)) {
      latestCheckinsByPlayer.set(checkin.player_id, checkin);
    }
  }

  const todayCheckinIds = new Set(
    healthCheckins.filter((c) => c.checkin_date === today).map((c) => c.player_id)
  );
  const checkedInToday = players.filter((p) => todayCheckinIds.has(p.id)).length;
  const notCheckedInToday = players.length - checkedInToday;
  const wellnessAlerts = players
    .map((player) => {
      const latest = latestCheckinsByPlayer.get(player.id);
      if (!latest) return null;
      const risk = healthRisk(latest);
      if (risk === "green") return null;
      return { player, checkin: latest, risk };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => (a.risk === "red" ? -1 : 1) - (b.risk === "red" ? -1 : 1));

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const feedbackWithPlayer = recentFeedback
    .map((f) => ({ feedback: f, player: playerMap.get(f.player_id) }))
    .filter((row): row is { feedback: typeof recentFeedback[number]; player: NonNullable<typeof players[number]> } =>
      row.player !== undefined
    );
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

  const checkinPct = players.length > 0 ? Math.round((checkedInToday / players.length) * 100) : 0;

  const todayTraining = nextTraining && nextTraining.date.toISOString().slice(0, 10) === today ? nextTraining : null;
  const todayMatch = nextMatch && nextMatch.date.toISOString().slice(0, 10) === today ? nextMatch : null;
  const nextEventLabel = todayTraining
    ? `Training${todayTraining.startTime ? ` · ${todayTraining.startTime.slice(0, 5)}` : ""}`
    : todayMatch
    ? `Spiel vs. ${todayMatch.opponent}${todayMatch.kickoffTime ? ` · ${todayMatch.kickoffTime.slice(0, 5)}` : ""}`
    : nextTraining
    ? `Nächstes Training · ${formatDate(nextTraining.date.toISOString().slice(0, 10))}`
    : nextMatch
    ? `Nächstes Spiel · ${formatDate(nextMatch.date.toISOString().slice(0, 10))}`
    : null;

  const hasTraining = trainings.length > 0;
  const hasPlayers = players.length > 0;
  const hasBasics = Boolean(team.season && team.ageGroup);

  return (
    <>
      {/* Onboarding-Tour (einmalig) */}
      <DashboardOnboarding />

      {/* Erste-Schritte-Pfad für neue Trainer (bis zum ersten Training) */}
      {!hasTraining ? (
        <FirstRunChecklist
          hasBasics={hasBasics}
          hasPlayers={hasPlayers}
          hasTraining={hasTraining}
        />
      ) : null}

      {/* Heute im Fokus */}
      {(feedbackWithPlayer.length > 0 || wellnessAlerts.length > 0) && players.length > 0 ? (
        <section className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-amber-50/60 to-orange-50/40 p-5 shadow-soft">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Heute im Fokus
                </p>
                <p className="text-[14px] font-semibold tracking-tight text-amber-950">
                {[
                  feedbackWithPlayer.length > 0 && `${feedbackWithPlayer.length} neue Nachricht${feedbackWithPlayer.length > 1 ? "en" : ""}`,
                  wellnessAlerts.filter((a) => a.risk === "red").length > 0 &&
                    `${wellnessAlerts.filter((a) => a.risk === "red").length} Spieler kritisch`,
                  wellnessAlerts.filter((a) => a.risk === "yellow").length > 0 &&
                    `${wellnessAlerts.filter((a) => a.risk === "yellow").length} Spieler auffällig`
                ]
                  .filter(Boolean)
                  .join(" · ")}
                </p>
              </div>
            </div>
            <Link
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-white/75 px-3 text-[12px] font-semibold text-amber-900 transition hover:bg-white"
              href="/notifications"
            >
              Alle Hinweise
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {/* Spieler-Nachrichten */}
            {feedbackWithPlayer.map(({ feedback, player }) => (
              <Link
                className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-white/70 p-3 transition hover:bg-white"
                href={`/players/${player.id}`}
                key={feedback.id}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <HeartPulse aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{player.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      · Stimmung {feedback.rating}/10 · vor {Math.round((Date.now() - new Date(feedback.created_at).getTime()) / 3600000)}h
                    </span>
                  </div>
                  {feedback.notes ? (
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-foreground/80">
                      &ldquo;{feedback.notes}&rdquo;
                    </p>
                  ) : null}
                </div>
                <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {/* Wellness-Alerts */}
            {wellnessAlerts.slice(0, 6).map(({ player, checkin, risk }) => (
              <Link
                className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-white/70 p-3 transition hover:bg-white"
                href={`/players/${player.id}`}
                key={player.id}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${risk === "red" ? "bg-red-500" : "bg-amber-400"}`}
                >
                  <span aria-hidden="true" className="text-[10px] font-bold">
                    {risk === "red" ? "🔴" : "🟡"}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-foreground">{player.name}</span>
                  <span className="ml-2 text-[12px] text-muted-foreground">
                    Schmerzen {checkin.pain}/5 · Müdigkeit {checkin.fatigue}/5 · Energie {checkin.energy}/5
                  </span>
                </div>
                <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button asChild size="sm" variant="outline">
              <Link href="/health">
                Alle Belastungen
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Tageskurzblick */}
      {players.length > 0 ? (
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Tageskurzblick
            </h2>
            <span className="text-[12px] text-muted-foreground">
              {germanLongDate(today)}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Check-in heute */}
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Check-in Heute
              </p>
              <p className="mt-1 text-[22px] font-semibold tracking-tight">
                {checkedInToday}
                <span className="text-[14px] font-normal text-muted-foreground">
                  /{players.length}
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${checkinPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {notCheckedInToday > 0
                  ? `${notCheckedInToday} noch ausstehend`
                  : "Alle eingecheckt ✓"}
              </p>
            </div>

            {/* Kader Status */}
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Kader
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[12px] font-medium text-emerald-800">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                  {availablePlayers} Fit
                </span>
                {limitedPlayersList.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-medium text-amber-800">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-amber-500"
                    />
                    {limitedPlayersList.length} Aufbau
                  </span>
                ) : null}
                {injuredPlayers.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-medium text-red-800">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-red-500"
                    />
                    {injuredPlayers.length} Verletzt
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {players.length} Spieler gesamt
              </p>
            </div>

            {/* Nächstes Event */}
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {todayTraining || todayMatch ? "Heute" : "Nächster Termin"}
              </p>
              {nextEventLabel ? (
                <>
                  <p className="mt-1 text-[13px] font-semibold tracking-tight leading-snug">
                    {nextEventLabel}
                  </p>
                  <Link
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    href={todayTraining || nextTraining ? "/trainings" : "/matches"}
                  >
                    Öffnen
                    <ArrowRight aria-hidden="true" className="h-3 w-3" />
                  </Link>
                </>
              ) : (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Keine Termine geplant
                </p>
              )}
            </div>

            {/* Offene Aufgaben */}
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Offene Aufgaben
              </p>
              <p className="mt-1 text-[22px] font-semibold tracking-tight">
                {openTasks.length}
              </p>
              {openTasks.length > 0 ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">
                  {openTasks[0].title}
                  {openTasks.length > 1 ? ` +${openTasks.length - 1} weitere` : ""}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Alles erledigt ✓
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <Suspense fallback={<DashboardAbsenceOverviewSkeleton />}>
        <DashboardAbsenceOverview teamId={teamId} />
      </Suspense>

      {/* Quick Actions */}
      <DashboardQuickActions players={checkinPlayers} />

      <DashboardDetails>
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
                    {formatDate(nextTraining.date.toISOString().slice(0, 10))}
                    {nextTraining.startTime
                      ? ` · ${nextTraining.startTime.slice(0, 5)}`
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
                    {formatDate(nextMatch.date.toISOString().slice(0, 10))}
                    {nextMatch.kickoffTime
                      ? ` · ${nextMatch.kickoffTime.slice(0, 5)}`
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
      </DashboardDetails>
    </>
  );
}

export default async function DashboardPage() {
  const { team } = await requireActiveTeam();

  return (
    <div className="space-y-8">
      <Hero team={team} />
      <Suspense fallback={<DashboardSectionsSkeleton />}>
        <DashboardSections team={team} />
      </Suspense>
    </div>
  );
}
