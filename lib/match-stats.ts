// Pure aggregation over structured match events. Dependency-free so it is
// unit-testable and reusable on both server and client.

export type MatchEventTypeValue =
  | "GOAL"
  | "ASSIST"
  | "YELLOW_CARD"
  | "RED_CARD"
  | "SUBSTITUTION";

export interface PlayerStatLine {
  playerId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  substitutions: number;
}

function emptyLine(playerId: string): PlayerStatLine {
  return {
    playerId,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    substitutions: 0,
  };
}

const FIELD_BY_TYPE: Record<MatchEventTypeValue, keyof Omit<PlayerStatLine, "playerId">> = {
  GOAL: "goals",
  ASSIST: "assists",
  YELLOW_CARD: "yellowCards",
  RED_CARD: "redCards",
  SUBSTITUTION: "substitutions",
};

/**
 * Aggregates match events into per-player stat lines. Works for a single match
 * or a whole season — just pass all the relevant events.
 */
export function aggregatePlayerStats(
  events: { playerId: string; type: MatchEventTypeValue }[]
): PlayerStatLine[] {
  const byPlayer = new Map<string, PlayerStatLine>();
  for (const event of events) {
    const line = byPlayer.get(event.playerId) ?? emptyLine(event.playerId);
    line[FIELD_BY_TYPE[event.type]] += 1;
    byPlayer.set(event.playerId, line);
  }
  // Most goals first, then assists — a sensible default for a scorer table.
  return [...byPlayer.values()].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists
  );
}
