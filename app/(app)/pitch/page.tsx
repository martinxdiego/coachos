import Link from "next/link";
import {
  CalendarCheck,
  ClipboardList,
  Shield,
  Trophy,
  UsersRound
} from "lucide-react";
import { saveAttendance } from "@/app/actions";
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
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PitchPage() {
  const { supabase, team } = await requireActiveTeam();
  const today = todayIsoDate();

  const [playersResult, trainingResult, matchResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position,jersey_number,status")
      .eq("team_id", team.id)
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("id,date,start_time,focus,goal,location,intensity")
      .eq("team_id", team.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,location,meeting_point,formation")
      .eq("team_id", team.id)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  for (const result of [playersResult, trainingResult, matchResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const players = playersResult.data ?? [];
  const training = trainingResult.data;
  const nextMatch = matchResult.data;

  const attendanceResult = training
    ? await supabase
        .from("attendance")
        .select("player_id,status")
        .eq("team_id", team.id)
        .eq("training_id", training.id)
    : { data: [], error: null };

  if (attendanceResult.error) {
    throw new Error(attendanceResult.error.message);
  }

  const attendance = new Map<string, AttendanceStatus>();
  for (const row of attendanceResult.data ?? []) {
    attendance.set(row.player_id, row.status);
  }

  const presentCount = players.filter(
    (player) => attendance.get(player.id) === "present"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Reduzierte mobile Ansicht für Training, Anwesenheit, Spieltag und Taktik auf dem Platz."
        title="Platz-Modus"
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <Card className="overflow-hidden border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Heute als Trainer</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Alles, was auf dem Platz schnell erreichbar sein muss.
                </p>
              </div>
              <Badge variant="success">{team.name}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Button asChild className="h-14 justify-between" variant="outline">
              <Link href="/trainings">
                Training
                <CalendarCheck aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="h-14 justify-between" variant="outline">
              <Link href="/tactics">
                Taktikboard
                <Shield aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="h-14 justify-between" variant="outline">
              <Link href="/matches">
                Matchday
                <Trophy aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="h-14 justify-between" variant="outline">
              <Link href="/players">
                Kader
                <UsersRound aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nächster Termin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {training ? (
              <div className="rounded-xl bg-slate-950 p-4 text-white">
                <p className="text-sm text-slate-300">Training</p>
                <p className="mt-1 text-lg font-semibold">{training.focus}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {formatDate(training.date)}
                  {training.start_time
                    ? ` · ${training.start_time.slice(0, 5)}`
                    : ""}
                  {training.location ? ` · ${training.location}` : ""}
                </p>
              </div>
            ) : null}
            {nextMatch ? (
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Spiel</p>
                <p className="mt-1 font-semibold">{nextMatch.opponent}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDate(nextMatch.date)}
                  {nextMatch.kickoff_time
                    ? ` · ${nextMatch.kickoff_time.slice(0, 5)}`
                    : ""}
                  {nextMatch.meeting_point
                    ? ` · Treffpunkt ${nextMatch.meeting_point}`
                    : ""}
                </p>
              </div>
            ) : null}
            {!training && !nextMatch ? (
              <EmptyState title="Kein kommender Termin geplant." />
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Anwesenheit</CardTitle>
              {training ? (
                <Badge variant="secondary">
                  {presentCount}/{players.length} anwesend
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {training && players.length > 0 ? (
              <form action={saveAttendance} className="space-y-4">
                <input name="training_id" type="hidden" value={training.id} />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {players.map((player) => {
                    const status = attendance.get(player.id);
                    return (
                      <label
                        className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-background/80 px-3 py-3 text-sm transition hover:border-primary/40 hover:bg-white"
                        key={player.id}
                      >
                        <input name="player_id" type="hidden" value={player.id} />
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                            {player.jersey_number ?? "-"}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {player.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {player.position ?? "Ohne Position"}
                            </span>
                          </span>
                        </span>
                        <input
                          className="h-6 w-6 rounded border-input accent-[hsl(var(--primary))]"
                          defaultChecked={status === "present"}
                          name="present_player_id"
                          type="checkbox"
                          value={player.id}
                        />
                      </label>
                    );
                  })}
                </div>
                <Button className="w-full sm:w-auto" type="submit">
                  Anwesenheit speichern
                </Button>
              </form>
            ) : (
              <EmptyState
                body="Plane zuerst ein kommendes Training, dann wird hier die schnelle Anwesenheit angezeigt."
                title="Noch keine Anwesenheit möglich."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platz-Checkliste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Material bereit",
              "Feld aufgebaut",
              "Anwesenheit erfasst",
              "Coachingpunkte klar",
              "Abschlussnotiz nach Training"
            ].map((item) => (
              <label
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-sm"
                key={item}
              >
                <span className="flex items-center gap-2">
                  <ClipboardList aria-hidden="true" className="h-4 w-4 text-primary" />
                  {item}
                </span>
                <input className="h-4 w-4" type="checkbox" />
              </label>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
