import Link from "next/link";
import { ArrowRight, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { attendanceStatusLabels } from "@/lib/attendance";
import { db } from "@/lib/db";
import type { AttendanceStatus } from "@/lib/types";
import { formatDate, todayIsoDate } from "@/lib/utils";

export async function DashboardTrainingAttendance({
  teamId
}: {
  teamId: string;
}) {
  const endOfToday = new Date(todayIsoDate() + "T23:59:59.999Z");
  const training = await db.training.findFirst({
    where: {
      workspaceId: teamId,
      date: { lte: endOfToday },
      attendance: { some: {} }
    },
    select: {
      id: true,
      date: true,
      focus: true,
      attendance: {
        where: {
          status: {
            notIn: ["present", "late", "individual"]
          }
        },
        select: {
          id: true,
          status: true,
          note: true,
          player: {
            select: {
              id: true,
              name: true,
              jerseyNumber: true
            }
          }
        },
        orderBy: {
          player: { name: "asc" }
        }
      },
      _count: {
        select: { attendance: true }
      }
    },
    orderBy: { date: "desc" }
  });

  if (!training || training.attendance.length === 0) return null;

  return (
    <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-card to-card shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <UserRoundX aria-hidden="true" className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                Letztes erfasstes Training
              </p>
              <CardTitle className="mt-0.5 truncate">
                {training.focus} · {formatDate(training.date.toISOString().slice(0, 10))}
              </CardTitle>
            </div>
          </div>
          <Badge className="shrink-0" variant="secondary">
            {training.attendance.length} von {training._count.attendance} abwesend
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {training.attendance.slice(0, 9).map((record) => (
            <li
              className="rounded-xl border border-amber-200/70 bg-white/80 px-3 py-2.5"
              key={record.id}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] font-semibold">
                  {record.player.jerseyNumber
                    ? "#" + record.player.jerseyNumber + " "
                    : ""}
                  {record.player.name}
                </p>
                <Badge className="shrink-0" variant="outline">
                  {attendanceStatusLabels[record.status as AttendanceStatus]}
                </Badge>
              </div>
              {record.note ? (
                <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                  {record.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {training.attendance.length > 9 ? (
          <p className="mt-2 text-[12px] font-medium text-amber-800">
            + {training.attendance.length - 9} weitere
          </p>
        ) : null}
        <Link
          className="mt-3 inline-flex min-h-10 items-center gap-2 text-[13px] font-semibold text-amber-900 hover:underline"
          href="/trainings"
        >
          Anwesenheit öffnen
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
