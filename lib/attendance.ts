import type { AttendanceStatus } from "@/lib/types";

export const attendanceStatuses = [
  "present",
  "late",
  "individual",
  "excused",
  "unexcused",
  "injured",
  "sick",
  "vacation",
  "not_selected",
  "absent"
] as const satisfies readonly AttendanceStatus[];

export const attendedAttendanceStatuses = [
  "present",
  "late",
  "individual"
] as const satisfies readonly AttendanceStatus[];

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Anwesend",
  late: "Zu spät",
  individual: "Individuell",
  excused: "Entschuldigt",
  unexcused: "Unentschuldigt",
  injured: "Verletzt",
  sick: "Krank",
  vacation: "Ferien",
  not_selected: "Nicht im Aufgebot",
  absent: "Ohne Angabe"
};

export function isAttendedStatus(status: AttendanceStatus | string | null | undefined) {
  return attendedAttendanceStatuses.includes(
    status as (typeof attendedAttendanceStatuses)[number]
  );
}

export function attendanceRate(
  rows: readonly { status: AttendanceStatus | string }[]
) {
  if (rows.length === 0) return null;
  const attended = rows.filter((row) => isAttendedStatus(row.status)).length;
  return Math.round((attended / rows.length) * 100);
}
