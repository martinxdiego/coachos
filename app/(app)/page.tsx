import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  Shield,
  Trophy,
  UsersRound
} from "lucide-react";
import { toggleTask } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, formatDateTime, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

function germanGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Hallo";
  if (hour < 22) return "Guten Abend";
  return "Gute Nacht";
}

export default async function DashboardPage() {
  const { supabase, team } = await requireActiveTeam();
  const today = todayIsoDate();

  const [
    playersResult,
    nextTrainingResult,
    nextMatchResult,
    trainingsResult,
    matchesResult,
    materialsResult,
    boardsResult,
    tasksResult
  ] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position,status,rating,jersey_number,birth_year")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_sessions")
      .select("id,date,start_time,duration_minutes,focus,goal,location,intensity")
      .eq("team_id", team.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,location,home_away,formation,result")
      .eq("team_id", team.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("training_sessions")
      .select("id,date,focus,intensity,created_at")
      .eq("team_id", team.id)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("matches")
      .select("id,date,opponent,result,formation,created_at")
      .eq("team_id", team.id)
      .order("date", { ascending: false })
      .limit(5),
    supabase
      .from("materials")
      .select("id,title,type,created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tactic_boards")
      .select("id,title,created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("tasks")
      .select("id,title,status,due_date,created_at")
      .eq("team_id", team.id)
      .order("status", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6)
  ]);

  for (const result of [
    playersResult,
    nextTrainingResult,
    nextMatchResult,
    trainingsResult,
    matchesResult,
    materialsResult,
    boardsResult,
    tasksResult
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
  const limitedPlayers = players.filter(
    (player) => player.status === "injured" || player.status === "limited"
  ).length;
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

  const heroFocus = nextTraining
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

  return (
    <div className="space-y-8">
      {/* Hero */}
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
              {team.season ?? "Aktuelle Saison"} ·{" "}
              {team.age_group ?? "Altersklasse offen"}
            </p>

            {heroFocus ? (
              <Link
                className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md ring-1 ring-white/15 transition hover:bg-white/15"
                href={heroFocus.href}
              >
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                  Nächstes {heroFocus.kind}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold tracking-tight">
                    {heroFocus.title}
                  </span>
                  <span className="block text-[12px] text-slate-300">
                    {heroFocus.subtitle}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-slate-300" />
              </Link>
            ) : (
              <p className="mt-6 text-[14px] text-slate-300">
                Plane deine Woche — Training, Spieltag, Material und Taktik an
                einem Ort.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              className="bg-white text-slate-950 hover:bg-slate-100"
              size="sm"
            >
              <Link href="/trainings">Training</Link>
            </Button>
            <Button
              asChild
              className="bg-white/10 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15"
              size="sm"
            >
              <Link href="/matches">Spieltag</Link>
            </Button>
            <Button
              asChild
              className="bg-white/10 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15"
              size="sm"
            >
              <Link href="/tactics">Taktik</Link>
            </Button>
          </div>
        </div>
      </section>

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
                body="Erstelle einen Plan mit Phasen, Material und Coachingpunkten."
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
                body="Plane Gegner, Treffpunkt, Aufgebot, Formation und Matchziele."
                title="Noch kein Spiel geplant."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Aufgaben & Aktivität */}
      <section className="grid gap-4 lg:grid-cols-2">
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
                title="Keine offenen Aufgaben."
              />
            )}
          </CardContent>
        </Card>

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
    </div>
  );
}
