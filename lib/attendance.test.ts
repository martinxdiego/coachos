import { describe, expect, it } from "vitest";
import {
  attendanceRate,
  attendanceStatuses,
  isAttendedStatus
} from "./attendance";

describe("attendance helpers", () => {
  it("counts present, late and individual training as attended", () => {
    expect(isAttendedStatus("present")).toBe(true);
    expect(isAttendedStatus("late")).toBe(true);
    expect(isAttendedStatus("individual")).toBe(true);
    expect(isAttendedStatus("injured")).toBe(false);
  });

  it("calculates a rounded attendance rate", () => {
    expect(
      attendanceRate([
        { status: "present" },
        { status: "late" },
        { status: "injured" }
      ])
    ).toBe(67);
    expect(attendanceRate([])).toBeNull();
  });

  it("keeps the historical generic absence status available", () => {
    expect(attendanceStatuses).toContain("absent");
  });
});
