import { describe, expect, it } from "vitest";
import { aggregatePlayerStats } from "./match-stats";

describe("aggregatePlayerStats", () => {
  it("counts each event type per player", () => {
    const stats = aggregatePlayerStats([
      { playerId: "a", type: "GOAL" },
      { playerId: "a", type: "GOAL" },
      { playerId: "a", type: "ASSIST" },
      { playerId: "b", type: "YELLOW_CARD" },
      { playerId: "b", type: "RED_CARD" },
      { playerId: "a", type: "SUBSTITUTION" },
    ]);
    const a = stats.find((s) => s.playerId === "a")!;
    const b = stats.find((s) => s.playerId === "b")!;
    expect(a).toMatchObject({ goals: 2, assists: 1, substitutions: 1 });
    expect(b).toMatchObject({ yellowCards: 1, redCards: 1, goals: 0 });
  });

  it("returns an empty array for no events", () => {
    expect(aggregatePlayerStats([])).toEqual([]);
  });

  it("sorts by goals then assists (scorer table order)", () => {
    const stats = aggregatePlayerStats([
      { playerId: "low", type: "GOAL" },
      { playerId: "high", type: "GOAL" },
      { playerId: "high", type: "GOAL" },
      { playerId: "mid", type: "GOAL" },
      { playerId: "mid", type: "ASSIST" },
      { playerId: "mid", type: "ASSIST" },
      { playerId: "low", type: "ASSIST" },
    ]);
    // high: 2 goals; mid & low tie on 1 goal, mid has more assists.
    expect(stats.map((s) => s.playerId)).toEqual(["high", "mid", "low"]);
  });
});
