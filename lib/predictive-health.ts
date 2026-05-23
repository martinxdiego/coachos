import { db } from "@/lib/db";

export interface InjuryRiskResult {
  score: number; // 0 to 100
  risk: "red" | "yellow" | "green";
  reasons: string[];
  recommendation: string;
  metrics: {
    fatigueAvg: number;
    sleepAvg: number;
    sorenessAvg: number;
    painAvg: number;
    injuryFeelingAvg: number;
    wellbeingAvg: number;
    recentWorkload: number; // sum of duration * intensity_multiplier
  };
}

export async function calculatePredictiveInjuryRisk(
  playerId: string,
  workspaceId: string
): Promise<InjuryRiskResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // 1. Fetch check-ins from the last 7 days
  const checkins = await db.healthCheck.findMany({
    where: {
      playerId,
      date: { gte: sevenDaysAgo },
    },
    orderBy: { date: "desc" },
  });

  // 2. Fetch training attendance and training details in the last 7 days
  const attendances = await db.attendance.findMany({
    where: {
      playerId,
      status: "present",
      training: {
        workspaceId,
        date: { gte: sevenDaysAgo },
      },
    },
    include: {
      training: true,
    },
  });

  // Default values if no checks exist
  let fatigueAvg = 3;
  let sleepAvg = 3;
  let sorenessAvg = 3;
  let painAvg = 1;
  let injuryFeelingAvg = 1;
  let wellbeingAvg = 3;

  if (checkins.length > 0) {
    const sumFatigue = checkins.reduce((s, c) => s + c.fatigue, 0);
    const sumSleep = checkins.reduce((s, c) => s + (c.sleepQuality ?? 3), 0);
    const sumSoreness = checkins.reduce((s, c) => s + c.soreness, 0);
    const sumPain = checkins.reduce((s, c) => s + c.pain, 0);
    const sumInjuryFeeling = checkins.reduce((s, c) => s + (c.injuryFeeling ?? 1), 0);
    const sumWellbeing = checkins.reduce((s, c) => s + (c.wellbeing ?? 3), 0);

    fatigueAvg = sumFatigue / checkins.length;
    sleepAvg = sumSleep / checkins.length;
    sorenessAvg = sumSoreness / checkins.length;
    painAvg = sumPain / checkins.length;
    injuryFeelingAvg = sumInjuryFeeling / checkins.length;
    wellbeingAvg = sumWellbeing / checkins.length;
  }

  // 3. Calculate Training Workload (Minutes * Intensity multiplier)
  let recentWorkload = 0;
  for (const att of attendances) {
    const duration = att.training.durationMinutes ?? att.training.duration ?? 90;
    const intensity = att.training.intensity ?? "medium";
    let multiplier = 1.5;
    if (intensity === "low") multiplier = 1.0;
    if (intensity === "high") multiplier = 2.0;
    recentWorkload += duration * multiplier;
  }

  // 4. Calculate Risk Score and compile reasons
  const reasons: string[] = [];
  let score = 0;

  // Pain Factor (weighted highly: pain >= 3 is risky, >= 4 is severe danger)
  if (painAvg >= 4) {
    score += 40;
    reasons.push(`Akute Schmerzen sind sehr hoch (Schnitt: ${painAvg.toFixed(1)}/5)`);
  } else if (painAvg >= 2.5) {
    score += 20;
    reasons.push(`Leichte bis mittlere Schmerzen vorhanden (Schnitt: ${painAvg.toFixed(1)}/5)`);
  }

  // Injury Feeling (subjective feeling of injury/instability)
  if (injuryFeelingAvg >= 4) {
    score += 30;
    reasons.push(`Subjektives Verletzungsgefuehl ist kritisch (Schnitt: ${injuryFeelingAvg.toFixed(1)}/5)`);
  } else if (injuryFeelingAvg >= 2.5) {
    score += 15;
    reasons.push(`Körperliches Unwohlsein/Instabilitaet gemeldet (Schnitt: ${injuryFeelingAvg.toFixed(1)}/5)`);
  }

  // Fatigue and Soreness (Muscle status)
  if (fatigueAvg >= 4) {
    score += 15;
    reasons.push(`Starke Erschoepfung über die Woche (Schnitt: ${fatigueAvg.toFixed(1)}/5)`);
  }
  if (sorenessAvg >= 4) {
    score += 15;
    reasons.push(`Starker Muskelkater in den letzten Tagen (Schnitt: ${sorenessAvg.toFixed(1)}/5)`);
  }

  // Sleep Quality
  if (sleepAvg <= 2.0) {
    score += 10;
    reasons.push(`Schlechte Schlafqualitaet (Schnitt: ${sleepAvg.toFixed(1)}/5)`);
  }

  // Workload (High workload combined with moderate risk triggers higher risk)
  if (recentWorkload > 350) {
    score += 15;
    reasons.push(`Sehr hohe wöchentliche Trainingsbelastung (${recentWorkload.toFixed(0)} Belastungspunkte)`);
  } else if (recentWorkload > 200) {
    score += 5;
  }

  // Wellbeing penalty
  if (wellbeingAvg <= 2.0) {
    score += 10;
    reasons.push(`Niedriges allgemeines Wohlbefinden (Schnitt: ${wellbeingAvg.toFixed(1)}/5)`);
  }

  // Cap score at 100
  score = Math.min(100, score);

  // Determine traffic light color
  let risk: "red" | "yellow" | "green" = "green";
  let recommendation = "Voll belastbar.";

  if (score >= 60 || painAvg >= 4 || injuryFeelingAvg >= 4) {
    risk = "red";
    recommendation = "Schonen / Trainingspause empfohlen. Ärztliche oder physiotherapeutische Abklärung ratsam.";
  } else if (score >= 30 || painAvg >= 2.5 || fatigueAvg >= 3.5 || sorenessAvg >= 3.5 || sleepAvg <= 2.2) {
    risk = "yellow";
    recommendation = "Belastung individuell steuern. Intensitaet reduzieren, Muskelkater & Schmerzen beobachten.";
  }

  // Fallback for players without checkins
  if (checkins.length === 0) {
    reasons.push("Keine aktuellen Check-ins in den letzten 7 Tagen erfasst.");
    recommendation = "Keine Daten vorhanden. Bitte Spieler zur Erfassung des Check-ins auffordern.";
  }

  return {
    score,
    risk,
    reasons,
    recommendation,
    metrics: {
      fatigueAvg,
      sleepAvg,
      sorenessAvg,
      painAvg,
      injuryFeelingAvg,
      wellbeingAvg,
      recentWorkload,
    },
  };
}
