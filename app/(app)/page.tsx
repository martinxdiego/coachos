import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  AlertCircle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Medal,
  Plus,
  Shield,
  Trophy,
  UsersRound
} from "lucide-react";
import { createTask, toggleTask } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
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
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, formatDateTime, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function metric(label: string, value: number | string, icon: ReactNode) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
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
    tasksResult,
    feedbackResult
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
      .limit(6),
    supabase
      .from("player_feedback")
      .select("id,rating,created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(5)
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
    feedbackResult
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

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-soft">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-300">
                Workspace Dashboard
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal">
                Plane die Woche für {team.name}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Schneller Zugriff auf Training, Spieltag, Spielerentwicklung,
                Material und Taktik. Alles ist an diesen Workspace gebunden.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                <Link href="/players">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Spieler
                </Link>
              </Button>
              <Button asChild className="border-white/15 bg-white/10 text-white hover:bg-white/15">
                <Link href="/trainings">Training</Link>
              </Button>
              <Button asChild className="border-white/15 bg-white/10 text-white hover:bg-white/15">
                <Link href="/tactics">Taktik</Link>
              </Button>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Schnellaufgabe</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTask} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="title">Aufgabe</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Kader bis Freitag finalisieren"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Fällig</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
              <Button className="w-full" type="submit">
                Aufgabe hinzufügen
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metric("Spieler", players.length, <UsersRound className="h-5 w-5" />)}
        {metric("Offene Aufgaben", openTasks.length, <ClipboardList className="h-5 w-5" />)}
        {metric("Materialien", materials.length, <FileText className="h-5 w-5" />)}
        {metric("Taktikboards", boards.length, <Shield className="h-5 w-5" />)}
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Trainer-Hinweise</CardTitle>
              <Badge variant={coachHints.length > 0 ? "secondary" : "success"}>
                {coachHints.length > 0 ? `${coachHints.length} offen` : "Alles bereit"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {coachHints.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {coachHints.slice(0, 6).map((hint) => (
                  <Link
                    className="group rounded-xl border border-border bg-background/70 p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white hover:shadow-soft"
                    href={hint.href}
                    key={hint.title}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="secondary">{hint.label}</Badge>
                      <AlertCircle
                        aria-hidden="true"
                        className="h-4 w-4 text-primary transition group-hover:scale-110"
                      />
                    </div>
                    <p className="mt-3 font-semibold">{hint.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {hint.body}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-950">
                <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
                <p className="text-sm font-medium">
                  Kader, nächste Termine und Kernplanung sehen vollständig aus.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Nächstes Training</CardTitle>
          </CardHeader>
          <CardContent>
            {nextTraining ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{nextTraining.focus}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(nextTraining.date)}
                        {nextTraining.start_time
                          ? ` · ${nextTraining.start_time.slice(0, 5)}`
                          : ""}
                      </p>
                    </div>
                    {nextTraining.intensity ? (
                      <Badge variant="success">{nextTraining.intensity}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {nextTraining.goal ?? "Noch kein Trainingsziel hinterlegt."}
                  </p>
                </div>
                <Button asChild variant="outline">
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
                <div className="rounded-xl bg-slate-950 p-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-300">Gegner</p>
                      <p className="mt-1 text-xl font-semibold">
                        {nextMatch.opponent}
                      </p>
                    </div>
                    <Trophy aria-hidden="true" className="h-5 w-5 text-emerald-300" />
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    {formatDate(nextMatch.date)}
                    {nextMatch.kickoff_time
                      ? ` · ${nextMatch.kickoff_time.slice(0, 5)}`
                      : ""}
                    {nextMatch.formation ? ` · ${nextMatch.formation}` : ""}
                  </p>
                </div>
                <Button asChild variant="outline">
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

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Offene Aufgaben</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <form
                  action={toggleTask}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-3 py-3"
                  key={task.id}
                >
                  <input name="id" type="hidden" value={task.id} />
                  <input name="status" type="hidden" value={task.status} />
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.due_date ? formatDate(task.due_date) : "Ohne Datum"}
                    </p>
                  </div>
                  <Button size="sm" type="submit" variant="outline">
                    {task.status === "done" ? "Erledigt" : "Offen"}
                  </Button>
                </form>
              ))
            ) : (
              <EmptyState title="Keine offenen Aufgaben." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-3 py-3"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.label}</Badge>
                      <p className="truncate text-sm font-medium">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="Noch keine Aktivität." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild className="justify-between" variant="outline">
              <Link href="/players">
                Spieler hinzufügen
                <UsersRound aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/trainings">
                Training erstellen
                <CalendarCheck aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/matches">
                Spiel planen
                <Trophy aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/winnerpunkte">
                Winnerpunkte vergeben
                <Medal aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/analysis">
                Spiel analysieren
                <BarChart3 aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/health">
                Belastung prüfen
                <HeartPulse aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/materials">
                Material erstellen
                <FileText aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="justify-between" variant="outline">
              <Link href="/tactics">
                Taktikboard öffnen
                <Shield aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
