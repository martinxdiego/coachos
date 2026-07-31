import { describe, expect, it } from "vitest";
import { calculateLoadSignal } from "./load-monitoring";

const normalCheckin = {
  fatigue: 2,
  sleepQuality: 4,
  soreness: 2,
  pain: 1,
  injuryFeeling: 1,
  wellbeing: 4
};

describe("calculateLoadSignal", () => {
  it("returns no traffic-light level without a recent check-in", () => {
    const result = calculateLoadSignal([], []);
    expect(result.level).toBeNull();
    expect(result.score).toBe(0);
  });

  it("marks an unremarkable self-report as green", () => {
    const result = calculateLoadSignal([normalCheckin], []);
    expect(result.level).toBe("green");
  });

  it("raises a red coaching signal for an acute pain report", () => {
    const result = calculateLoadSignal(
      [{ ...normalCheckin, pain: 5 }],
      []
    );
    expect(result.level).toBe("red");
    expect(result.recommendation).toContain("medizinische Fachperson");
  });

  it("does not average away today's acute pain among six low values", () => {
    const result = calculateLoadSignal(
      [
        // Inputs arrive newest first; today's high value must override the
        // otherwise low seven-day average.
        { ...normalCheckin, pain: 5 },
        ...Array.from({ length: 6 }, () => ({ ...normalCheckin, pain: 1 }))
      ],
      []
    );

    expect(result.level).toBe("red");
    expect(result.reasons).toContain(
      "Hohe einzelne Schmerzmeldung im Zeitraum (max. 5.0/5)"
    );
    expect(result.recommendation).toContain("keine Diagnose");
  });

  it("uses the highest physical-uncertainty report as a red override", () => {
    const result = calculateLoadSignal(
      [
        { ...normalCheckin, injuryFeeling: 4 },
        ...Array.from({ length: 6 }, () => ({
          ...normalCheckin,
          injuryFeeling: 1
        }))
      ],
      []
    );

    expect(result.level).toBe("red");
    expect(result.reasons).toContain(
      "Hohe einzelne körperliche Unsicherheitsmeldung im Zeitraum (max. 4.0/5)"
    );
  });

  it("includes recent training load without claiming an injury prediction", () => {
    const result = calculateLoadSignal(
      [normalCheckin],
      [
        { durationMinutes: 120, intensity: "high" },
        { durationMinutes: 90, intensity: "high" }
      ]
    );
    expect(result.metrics.recentWorkload).toBe(420);
    expect(JSON.stringify(result)).not.toMatch(/prognose|diagnose/i);
  });
});
