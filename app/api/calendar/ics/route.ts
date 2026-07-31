import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function datePart(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function dateTimePart(date: Date, time: string) {
  const normalized = /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5).replace(":", "") : "0000";
  return `${datePart(date)}T${normalized}00`;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + count);
  return next;
}

function addMinutes(date: Date, time: string, minutes: number) {
  const [hours, mins] = time.slice(0, 5).split(":").map(Number);
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, mins));
  result.setUTCMinutes(result.getUTCMinutes() + minutes);
  return `${datePart(result)}T${String(result.getUTCHours()).padStart(2, "0")}${String(result.getUTCMinutes()).padStart(2, "0")}00`;
}

function eventLines(event: {
  uid: string;
  date: Date;
  time: string | null;
  durationMinutes: number;
  title: string;
  description?: string | null;
  location?: string | null;
}) {
  const lines = ["BEGIN:VEVENT", `UID:${escapeIcs(event.uid)}`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`];

  if (event.time) {
    lines.push(`DTSTART;TZID=Europe/Zurich:${dateTimePart(event.date, event.time)}`);
    lines.push(`DTEND;TZID=Europe/Zurich:${addMinutes(event.date, event.time, event.durationMinutes)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${datePart(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${datePart(addDays(event.date, 1))}`);
  }

  lines.push(`SUMMARY:${escapeIcs(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  lines.push("END:VEVENT");
  return lines;
}

export async function GET() {
  const { team } = await requireActiveTeam();
  const [trainings, matches] = await Promise.all([
    db.training.findMany({
      where: { workspaceId: team.id, isTemplate: false },
      orderBy: { date: "asc" },
      take: 1000
    }),
    db.match.findMany({
      where: { workspaceId: team.id },
      orderBy: { date: "asc" },
      take: 1000
    })
  ]);

  const events = [
    ...trainings.flatMap((training) =>
      eventLines({
        uid: `training-${training.id}@coachos`,
        date: training.date,
        time: training.startTime,
        durationMinutes: training.durationMinutes,
        title: `Training: ${training.focus}`,
        description: training.goal ?? training.notes,
        location: training.location
      })
    ),
    ...matches.flatMap((match) =>
      eventLines({
        uid: `match-${match.id}@coachos`,
        date: match.date,
        time: match.kickoffTime,
        durationMinutes: 120,
        title: `Spiel gegen ${match.opponent}`,
        description: [match.competition, match.meetingPoint ? `Treffpunkt: ${match.meetingPoint}` : null]
          .filter(Boolean)
          .join(" · "),
        location: match.location
      })
    )
  ];

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoachOS//Teamkalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`${team.name} · CoachOS`)}`,
    "X-WR-TIMEZONE:Europe/Zurich",
    ...events,
    "END:VCALENDAR",
    ""
  ].join("\r\n");

  const safeName = team.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "team";
  return new Response(calendar, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeName}-coachos.ics"`,
      "Content-Type": "text/calendar; charset=utf-8"
    }
  });
}
