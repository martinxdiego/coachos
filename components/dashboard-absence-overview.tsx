import Link from "next/link";
import { ArrowRight, CalendarX2, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { formatDate, todayIsoDate } from "@/lib/utils";

type UpcomingEvent = {
  id: string;
  type: "TRAINING" | "MATCH";
  label: string;
  title: string;
  date: Date;
  time: string | null;
};

export async function DashboardAbsenceOverview({
  teamId
}: {
  teamId: string;
}) {
  const today = new Date(`${todayIsoDate()}T00:00:00.000Z`);
  const [trainings, matches] = await Promise.all([
    db.training.findMany({
      where: { workspaceId: teamId, date: { gte: today } },
      select: { id: true, date: true, startTime: true, focus: true },
      orderBy: { date: "asc" },
      take: 3
    }),
    db.match.findMany({
      where: { workspaceId: teamId, date: { gte: today } },
      select: { id: true, date: true, kickoffTime: true, opponent: true },
      orderBy: { date: "asc" },
      take: 3
    })
  ]);

  const events: UpcomingEvent[] = [
    ...trainings.map((training) => ({
      id: training.id,
      type: "TRAINING" as const,
      label: "Training",
      title: training.focus,
      date: training.date,
      time: training.startTime
    })),
    ...matches.map((match) => ({
      id: match.id,
      type: "MATCH" as const,
      label: "Spiel",
      title: `vs. ${match.opponent}`,
      date: match.date,
      time: match.kickoffTime
    }))
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);

  if (events.length === 0) return null;

  const absences = await db.availabilityResponse.findMany({
    where: {
      workspaceId: teamId,
      status: "NO",
      OR: events.map((event) => ({
        eventType: event.type,
        eventId: event.id
      }))
    },
    select: {
      eventType: true,
      eventId: true,
      comment: true,
      player: {
        select: { id: true, name: true, jerseyNumber: true }
      }
    },
    orderBy: { respondedAt: "desc" }
  });

  if (absences.length === 0) return null;

  const absencesByEvent = new Map<string, typeof absences>();
  for (const absence of absences) {
    const key = `${absence.eventType}:${absence.eventId}`;
    const rows = absencesByEvent.get(key) ?? [];
    rows.push(absence);
    absencesByEvent.set(key, rows);
  }

  return (
    <Card className="border-red-200/80 bg-gradient-to-br from-red-50/90 via-card to-card shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <CalendarX2 aria-hidden="true" className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">
                Kaderhinweis
              </p>
              <CardTitle className="mt-0.5">Abmeldungen nächste Termine</CardTitle>
            </div>
          </div>
          <Badge className="shrink-0" variant="destructive">
            {absences.length} {absences.length === 1 ? "Abmeldung" : "Abmeldungen"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-3">
          {events.map((event) => {
            const eventAbsences =
              absencesByEvent.get(`${event.type}:${event.id}`) ?? [];
            if (eventAbsences.length === 0) return null;

            return (
              <div
                className="rounded-2xl border border-red-200/70 bg-white/80 p-4"
                key={`${event.type}:${event.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700">
                      {event.label} · {formatDate(event.date.toISOString().slice(0, 10))}
                    </p>
                    <p className="mt-1 truncate text-[14px] font-semibold tracking-tight">
                      {event.title}
                      {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
                    </p>
                  </div>
                  <Badge className="shrink-0" variant="destructive">
                    {eventAbsences.length} abwesend
                  </Badge>
                </div>
                <ul className="mt-3 space-y-2">
                  {eventAbsences.slice(0, 4).map((absence) => (
                    <li className="flex items-start gap-2 text-[13px]" key={absence.player.id}>
                      <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {absence.player.jerseyNumber
                            ? `#${absence.player.jerseyNumber} `
                            : ""}
                          {absence.player.name}
                        </p>
                        {absence.comment ? (
                          <p className="mt-0.5 flex items-start gap-1 text-[12px] leading-5 text-muted-foreground">
                            <MessageSquareText aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="line-clamp-2">{absence.comment}</span>
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {eventAbsences.length > 4 ? (
                  <p className="mt-2 text-[12px] font-medium text-red-700">
                    + {eventAbsences.length - 4} weitere
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-1 text-[13px] font-semibold text-red-800 transition hover:text-red-950"
          href="/availability"
        >
          Vollständige Zu- und Absagen öffnen
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function DashboardAbsenceOverviewSkeleton() {
  return (
    <Card className="border-red-200/60">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-28 rounded-2xl" key={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
