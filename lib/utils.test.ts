import { describe, expect, it } from "vitest";
import { cn, formatDate, todayIsoDate } from "./utils";

describe("todayIsoDate", () => {
  it("returns an ISO yyyy-mm-dd date", () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses the Zurich calendar day instead of UTC", () => {
    const justAfterUtcMidnight = new Date("2026-01-01T23:30:00.000Z");
    expect(todayIsoDate(justAfterUtcMidnight)).toBe("2026-01-02");
  });
});

describe("formatDate", () => {
  it("returns placeholder for empty", () => {
    expect(formatDate(null)).toBe("Kein Datum");
    expect(formatDate(undefined)).toBe("Kein Datum");
  });
  it("formats a date string", () => {
    expect(formatDate("2026-06-13")).toContain("2026");
  });
});

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe(
      "text-sm font-bold"
    );
  });
});
