import type { HealthCheckin, PlayerEvaluation, WinnerPoint } from "@/lib/types";

export function evaluationAverage(evaluation: Pick<
  PlayerEvaluation,
  | "participation"
  | "motivation"
  | "training_quality"
  | "match_quality"
  | "behavior"
  | "effort"
  | "concentration"
>) {
  const values = [
    evaluation.participation,
    evaluation.motivation,
    evaluation.training_quality,
    evaluation.match_quality,
    evaluation.behavior,
    evaluation.effort,
    evaluation.concentration
  ].filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function winnerPointTotal(points: Pick<WinnerPoint, "points">[]) {
  return points.reduce((sum, point) => sum + point.points, 0);
}

export function healthRisk(checkin: Pick<
  HealthCheckin,
  | "fatigue"
  | "sleep_quality"
  | "soreness"
  | "pain"
  | "stress"
  | "motivation"
  | "energy"
  | "injury_feeling"
  | "wellbeing"
>) {
  const red =
    checkin.pain >= 4 ||
    checkin.injury_feeling >= 4 ||
    checkin.fatigue >= 4 ||
    checkin.energy <= 2 ||
    checkin.wellbeing <= 2;

  if (red) {
    return "red";
  }

  const yellow =
    checkin.sleep_quality <= 2 ||
    checkin.soreness >= 4 ||
    checkin.stress >= 4 ||
    checkin.motivation <= 2;

  return yellow ? "yellow" : "green";
}
