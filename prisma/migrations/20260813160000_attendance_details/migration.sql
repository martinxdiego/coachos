ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'excused';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'unexcused';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'injured';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'sick';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'vacation';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'late';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'individual';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'not_selected';

ALTER TABLE "Attendance"
  ADD COLUMN "note" TEXT,
  ADD COLUMN "lateMinutes" INTEGER,
  ADD COLUMN "participationPercent" INTEGER;

ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_lateMinutes_check"
    CHECK ("lateMinutes" IS NULL OR ("lateMinutes" >= 0 AND "lateMinutes" <= 240)),
  ADD CONSTRAINT "Attendance_participationPercent_check"
    CHECK (
      "participationPercent" IS NULL
      OR ("participationPercent" >= 0 AND "participationPercent" <= 100)
    );
