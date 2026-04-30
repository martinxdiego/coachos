import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
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

export const dynamic = "force-dynamic";

type CalendarView = "day" | "week" | "month" | "year";

interface CalendarPageProps {
  searchParams?: Promise<{
    date?: string;
    view?: string;
  }>;
}

interface CalendarEvent {
  id: string;
  date: string;
  time: string | null;
  title: string;
  location: string | null;
  type: "Training" | "Spiel";
  href: string;
}

const dayFormatter = new Intl.DateTimeFormat("de-CH", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit"
});

const titleFormatter = new Intl.DateTimeFormat("de-CH", {
  month: "long",
  year: "numeric"
});

const fullDateFormatter = new Intl.DateTimeFormat("de-CH", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric"
});

function parseDate(value?: string) {
  if (!value) {
    return new Date();
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  return next;
}

function daysInMonth(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: last }, (_, index) => new Date(year, month, index + 1));
}

function monthOffset(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return (first.getDay() + 6) % 7;
}

function eventsFor(eventsByDate: Map<string, CalendarEvent[]>, date: Date) {
  return eventsByDate.get(toIsoDate(date)) ?? [];
}

function ViewLink({
  children,
  date,
  isActive,
  view
}: {
  children: ReactNode;
  date: string;
  isActive: boolean;
  view: CalendarView;
}) {
  return (
    <Link
      className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition ${
        isActive
          ? "bg-slate-950 text-white"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      }`}
      href={`/calendar?view=${view}&date=${date}`}
    >
      {children}
    </Link>
  );
}

function EventPill({ event }: { event: CalendarEvent }) {
  return (
    <Link
      className="block rounded-lg border border-border bg-white px-2 py-1.5 text-xs transition hover:border-primary/40"
      href={event.href}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{event.title}</span>
        <Badge variant={event.type === "Spiel" ? "success" : "secondary"}>
          {event.type}
        </Badge>
      </span>
      <span className="mt-1 block truncate text-muted-foreground">
        {event.time ? event.time.slice(0, 5) : "Ganztag"}
        {event.location ? ` · ${event.location}` : ""}
      </span>
    </Link>
  );
}

function CreateLinks({ date }: { date: Date }) {
  const iso = toIsoDate(date);

  return (
    <div className="grid grid-cols-2 gap-1.5 no-print">
      <Link
        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100"
        href={`/trainings?date=${iso}`}
      >
        <CalendarPlus aria-hidden="true" className="h-3.5 w-3.5" />
        Training
      </Link>
      <Link
        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-slate-950 px-2 text-[11px] font-medium text-white transition hover:bg-slate-800"
        href={`/matches?date=${iso}`}
      >
        <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
        Spiel
      </Link>
    </div>
  );
}

function MonthGrid({
  date,
  eventsByDate
}: {
  date: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
}) {
  const days = daysInMonth(date);
  const offset = monthOffset(date);

  return (
    <div className="grid grid-cols-7 gap-2">
      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground" key={day}>
          {day}
        </div>
      ))}
      {Array.from({ length: offset }, (_, index) => (
        <div className="min-h-28 rounded-xl bg-slate-100/60" key={`blank-${index}`} />
      ))}
      {days.map((day) => {
        const events = eventsFor(eventsByDate, day);
        return (
          <div
            className="min-h-28 rounded-xl border border-border bg-background/70 p-2"
            key={toIsoDate(day)}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{day.getDate()}</p>
            </div>
            <div className="mt-2">
              <CreateLinks date={day} />
            </div>
            <div className="mt-2 space-y-1">
              {events.slice(0, 3).map((event) => (
                <EventPill event={event} key={event.id} />
              ))}
              {events.length > 3 ? (
                <p className="text-xs text-muted-foreground">
                  +{events.length - 3} weitere
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const { supabase, team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const view = (["day", "week", "month", "year"].includes(
    resolvedSearchParams?.view ?? ""
  )
    ? resolvedSearchParams?.view
    : "month") as CalendarView;
  const selectedDate = parseDate(resolvedSearchParams?.date);
  const selectedIso = toIsoDate(selectedDate);

  const [trainingsResult, matchesResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id,date,start_time,focus,location")
      .eq("team_id", team.id)
      .order("date", { ascending: true })
      .limit(300),
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,location")
      .eq("team_id", team.id)
      .order("date", { ascending: true })
      .limit(300)
  ]);

  if (trainingsResult.error) {
    throw new Error(trainingsResult.error.message);
  }

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }

  const events: CalendarEvent[] = [
    ...(trainingsResult.data ?? []).map((event) => ({
      id: `training-${event.id}`,
      date: event.date,
      time: event.start_time,
      title: event.focus,
      location: event.location,
      type: "Training" as const,
      href: "/trainings"
    })),
    ...(matchesResult.data ?? []).map((event) => ({
      id: `match-${event.id}`,
      date: event.date,
      time: event.kickoff_time,
      title: event.opponent,
      location: event.location,
      type: "Spiel" as const,
      href: "/matches"
    }))
  ].sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`));

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  }

  const previousDate =
    view === "day"
      ? addDays(selectedDate, -1)
      : view === "week"
        ? addDays(selectedDate, -7)
        : view === "month"
          ? addMonths(selectedDate, -1)
          : addYears(selectedDate, -1);
  const nextDate =
    view === "day"
      ? addDays(selectedDate, 1)
      : view === "week"
        ? addDays(selectedDate, 7)
        : view === "month"
          ? addMonths(selectedDate, 1)
          : addYears(selectedDate, 1);
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(startOfWeek(selectedDate), index)
  );
  const yearMonths = Array.from(
    { length: 12 },
    (_, index) => new Date(selectedDate.getFullYear(), index, 1)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description="Tages-, Wochen-, Monats- und Jahresplanung mit Training und Spiel."
        title="Kalender"
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>
                {view === "year"
                  ? selectedDate.getFullYear()
                  : view === "day"
                    ? fullDateFormatter.format(selectedDate)
                    : titleFormatter.format(selectedDate)}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {events.length} geplante Termine im Workspace
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/calendar?view=${view}&date=${toIsoDate(previousDate)}`}>
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <ViewLink date={selectedIso} isActive={view === "day"} view="day">
                Tag
              </ViewLink>
              <ViewLink date={selectedIso} isActive={view === "week"} view="week">
                Woche
              </ViewLink>
              <ViewLink date={selectedIso} isActive={view === "month"} view="month">
                Monat
              </ViewLink>
              <ViewLink date={selectedIso} isActive={view === "year"} view="year">
                Jahr
              </ViewLink>
              <Button asChild size="sm" variant="outline">
                <Link href={`/calendar?view=${view}&date=${toIsoDate(nextDate)}`}>
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === "day" ? (
            <div className="min-h-[520px] rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-lg font-semibold">
                  {fullDateFormatter.format(selectedDate)}
                </p>
                <div className="w-full sm:w-64">
                  <CreateLinks date={selectedDate} />
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {eventsFor(eventsByDate, selectedDate).length > 0 ? (
                  eventsFor(eventsByDate, selectedDate).map((event) => (
                    <EventPill event={event} key={event.id} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Kein Termin an diesem Tag.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {view === "week" ? (
            <div className="grid gap-2 lg:grid-cols-7">
              {weekDays.map((day) => (
                <div
                  className="min-h-[420px] rounded-2xl border border-border bg-background/70 p-3"
                  key={toIsoDate(day)}
                >
                  <div className="space-y-2">
                    <p className="font-semibold">{dayFormatter.format(day)}</p>
                    <CreateLinks date={day} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {eventsFor(eventsByDate, day).map((event) => (
                      <EventPill event={event} key={event.id} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {view === "month" ? (
            <MonthGrid date={selectedDate} eventsByDate={eventsByDate} />
          ) : null}

          {view === "year" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {yearMonths.map((month) => {
                const monthEvents = events.filter((event) => {
                  const date = parseDate(event.date);
                  return (
                    date.getFullYear() === month.getFullYear() &&
                    date.getMonth() === month.getMonth()
                  );
                });

                return (
                  <Link
                    className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-primary/40 hover:bg-white"
                    href={`/calendar?view=month&date=${toIsoDate(month)}`}
                    key={month.getMonth()}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">
                        {titleFormatter.format(month)}
                      </p>
                      <Badge variant="secondary">{monthEvents.length}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {monthEvents.slice(0, 4).map((event) => (
                        <div className="text-xs text-muted-foreground" key={event.id}>
                          {event.date.slice(8, 10)} · {event.type} · {event.title}
                        </div>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
