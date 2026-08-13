import Link from "next/link";
import {
  CalendarCheck,
  ClipboardList,
  Shield,
  Trophy,
  UsersRound
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AttendanceEditor } from "@/components/attendance-editor";
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
import { db } from "@/lib/db";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { isAttendedStatus } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export default async function PitchPage() {
  const { team } = await requireActiveTeam();
  const t = await getTranslations("pages");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [dbPlayers, dbTraining, dbMatch] = await Promise.all([
    db.player.findMany({
      where: { workspaceId: team.id },
      select: {
        id: true,
        name: true,
        position: true,
        jerseyNumber: true,
        status: true
      },
      orderBy: [
        { jerseyNumber: "asc" },
        { name: "asc" }
      ]
    }),
    db.training.findFirst({
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
        location: true,
        intensity: true
      },
      orderBy: { date: "asc" }
    }),
    db.match.findFirst({
      where: {
        workspaceId: team.id,
        date: { gte: todayStart }
      },
      select: {
        id: true,
        date: true,
        kickoffTime: true,
        opponent: true,
        location: true,
        meetingPoint: true,
        formation: true
      },
      orderBy: { date: "asc" }
    })
  ]);

  const players = dbPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    jersey_number: p.jerseyNumber,
    status: p.status.toLowerCase() as any
  }));

  const training = dbTraining
    ? {
        id: dbTraining.id,
        date: dbTraining.date.toISOString().slice(0, 10),
        start_time: dbTraining.startTime,
        focus: dbTraining.focus,
        goal: dbTraining.goal,
        location: dbTraining.location,
        intensity: dbTraining.intensity
      }
    : null;

  const nextMatch = dbMatch
    ? {
        id: dbMatch.id,
        date: dbMatch.date.toISOString().slice(0, 10),
        kickoff_time: dbMatch.kickoffTime,
        opponent: dbMatch.opponent,
        location: dbMatch.location,
        meeting_point: dbMatch.meetingPoint,
        formation: dbMatch.formation
      }
    : null;

  const dbAttendance = training
    ? await db.attendance.findMany({
        where: {
          trainingId: training.id
        },
        select: {
          playerId: true,
          status: true,
          note: true,
          lateMinutes: true,
          participationPercent: true
        }
      })
    : [];

  const attendance = dbAttendance.map((row) => ({
    player_id: row.playerId,
    status: row.status,
    note: row.note,
    late_minutes: row.lateMinutes,
    participation_percent: row.participationPercent
  }));
  const attendanceByPlayer = new Map(
    attendance.map((row) => [row.player_id, row])
  );

  const presentCount = players.filter(
    (player) => isAttendedStatus(attendanceByPlayer.get(player.id)?.status)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("pitch_desc")}
        title={t("pitch_title")}
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
              <AttendanceEditor
                attendance={attendance}
                players={players}
                trainingId={training.id}
              />
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
