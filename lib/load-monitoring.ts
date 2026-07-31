export type LoadLevel = "red" | "yellow" | "green";

export interface LoadCheckin {
  fatigue: number;
  sleepQuality: number | null;
  soreness: number;
  pain: number;
  injuryFeeling: number | null;
  wellbeing: number | null;
}

export interface LoadAttendance {
  durationMinutes: number | null;
  intensity: string | null;
}

export interface LoadSignalResult {
  score: number;
  level: LoadLevel | null;
  reasons: string[];
  recommendation: string;
  metrics: {
    fatigueAvg: number;
    sleepAvg: number;
    sorenessAvg: number;
    painAvg: number;
    injuryFeelingAvg: number;
    wellbeingAvg: number;
    recentWorkload: number;
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * A coaching load signal based on self-reported wellbeing and recent training.
 * It is deliberately not an injury prediction, diagnosis, or medical decision.
 */
export function calculateLoadSignal(
  checkins: readonly LoadCheckin[],
  attendances: readonly LoadAttendance[]
): LoadSignalResult {
  const recentWorkload = attendances.reduce((sum, attendance) => {
    const duration = attendance.durationMinutes ?? 90;
    const multiplier =
      attendance.intensity === "low"
        ? 1
        : attendance.intensity === "high"
          ? 2
          : 1.5;
    return sum + duration * multiplier;
  }, 0);

  if (checkins.length === 0) {
    return {
      score: 0,
      level: null,
      reasons: ["Kein aktueller Check-in in den letzten 7 Tagen."],
      recommendation: "Vor der Belastungsplanung persönlich nachfragen.",
      metrics: {
        fatigueAvg: 0,
        sleepAvg: 0,
        sorenessAvg: 0,
        painAvg: 0,
        injuryFeelingAvg: 0,
        wellbeingAvg: 0,
        recentWorkload
      }
    };
  }

  const fatigueAvg = average(checkins.map((checkin) => checkin.fatigue));
  const sleepAvg = average(
    checkins.map((checkin) => checkin.sleepQuality ?? 3)
  );
  const sorenessAvg = average(checkins.map((checkin) => checkin.soreness));
  const painValues = checkins.map((checkin) => checkin.pain);
  const injuryFeelingValues = checkins.map(
    (checkin) => checkin.injuryFeeling ?? 1
  );
  const painAvg = average(painValues);
  const injuryFeelingAvg = average(injuryFeelingValues);
  const painMax = Math.max(...painValues);
  const injuryFeelingMax = Math.max(...injuryFeelingValues);
  const wellbeingAvg = average(
    checkins.map((checkin) => checkin.wellbeing ?? 3)
  );

  const reasons: string[] = [];
  let score = 0;

  if (painAvg >= 4) {
    score += 40;
    reasons.push(`Sehr hohe Schmerzmeldung (${painAvg.toFixed(1)}/5)`);
  } else if (painMax >= 4) {
    score += 40;
    reasons.push(
      `Hohe einzelne Schmerzmeldung im Zeitraum (max. ${painMax.toFixed(1)}/5)`
    );
  } else if (painAvg >= 2.5) {
    score += 20;
    reasons.push(`Erhöhte Schmerzmeldung (${painAvg.toFixed(1)}/5)`);
  }

  if (injuryFeelingAvg >= 4) {
    score += 30;
    reasons.push(
      `Starkes körperliches Unsicherheitsgefühl (${injuryFeelingAvg.toFixed(1)}/5)`
    );
  } else if (injuryFeelingMax >= 4) {
    score += 30;
    reasons.push(
      `Hohe einzelne körperliche Unsicherheitsmeldung im Zeitraum (max. ${injuryFeelingMax.toFixed(1)}/5)`
    );
  } else if (injuryFeelingAvg >= 2.5) {
    score += 15;
    reasons.push(
      `Körperliches Unsicherheitsgefühl (${injuryFeelingAvg.toFixed(1)}/5)`
    );
  }

  if (fatigueAvg >= 4) {
    score += 15;
    reasons.push(`Hohe Müdigkeit (${fatigueAvg.toFixed(1)}/5)`);
  }
  if (sorenessAvg >= 4) {
    score += 15;
    reasons.push(`Hoher Muskelkater (${sorenessAvg.toFixed(1)}/5)`);
  }
  if (sleepAvg <= 2) {
    score += 10;
    reasons.push(`Tiefe Schlafqualität (${sleepAvg.toFixed(1)}/5)`);
  }
  if (recentWorkload > 350) {
    score += 15;
    reasons.push(
      `Hohe Wochenbelastung (${recentWorkload.toFixed(0)} Belastungspunkte)`
    );
  } else if (recentWorkload > 200) {
    score += 5;
  }
  if (wellbeingAvg <= 2) {
    score += 10;
    reasons.push(`Tiefes Wohlbefinden (${wellbeingAvg.toFixed(1)}/5)`);
  }

  score = Math.min(100, score);

  let level: LoadLevel = "green";
  let recommendation =
    "Keine auffällige Belastungsmeldung. Persönlichen Eindruck weiterhin berücksichtigen.";

  if (score >= 60 || painMax >= 4 || injuryFeelingMax >= 4) {
    level = "red";
    recommendation =
      "Vor Belastung persönlich Rücksprache halten und die Belastung bis zur Klärung aussetzen. Bei Beschwerden an eine medizinische Fachperson verweisen. Dieser Belastungshinweis ist keine Diagnose.";
  } else if (
    score >= 30 ||
    painAvg >= 2.5 ||
    fatigueAvg >= 3.5 ||
    sorenessAvg >= 3.5 ||
    sleepAvg <= 2.2
  ) {
    level = "yellow";
    recommendation =
      "Belastung vorsichtig planen, Rückmeldung einholen und Entwicklung beobachten.";
  }

  return {
    score,
    level,
    reasons,
    recommendation,
    metrics: {
      fatigueAvg,
      sleepAvg,
      sorenessAvg,
      painAvg,
      injuryFeelingAvg,
      wellbeingAvg,
      recentWorkload
    }
  };
}
