import { describe, expect, it } from "vitest";
import { evaluationAverage, healthRisk, winnerPointTotal } from "./coach-metrics";

describe("evaluationAverage", () => {
  it("averages provided numeric fields, ignores nulls", () => {
    const avg = evaluationAverage({
      participation: 4,
      motivation: 2,
      training_quality: null,
      match_quality: null,
      behavior: null,
      effort: null,
      concentration: null,
    } as any);
    expect(avg).toBe(3);
  });
  it("returns null when nothing scored", () => {
    expect(
      evaluationAverage({
        participation: null,
        motivation: null,
        training_quality: null,
        match_quality: null,
        behavior: null,
        effort: null,
        concentration: null,
      } as any)
    ).toBeNull();
  });
});

describe("winnerPointTotal", () => {
  it("sums points", () => {
    expect(winnerPointTotal([{ points: 3 }, { points: 5 }, { points: 1 }])).toBe(9);
    expect(winnerPointTotal([])).toBe(0);
  });
});

describe("healthRisk", () => {
  const base = {
    fatigue: 2,
    sleep_quality: 4,
    soreness: 2,
    pain: 1,
    stress: 2,
    motivation: 4,
    energy: 4,
    injury_feeling: 1,
    wellbeing: 4,
  };
  it("green when all nominal", () => {
    expect(healthRisk(base as any)).toBe("green");
  });
  it("red on high pain", () => {
    expect(healthRisk({ ...base, pain: 4 } as any)).toBe("red");
  });
  it("red on low energy", () => {
    expect(healthRisk({ ...base, energy: 2 } as any)).toBe("red");
  });
  it("yellow on poor sleep without red triggers", () => {
    expect(healthRisk({ ...base, sleep_quality: 2 } as any)).toBe("yellow");
  });
});
