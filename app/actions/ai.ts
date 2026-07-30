"use server";

import {
  aggregateTeamLoadSignals,
  generateTrainingPlan,
  normalizeAiAgeGroup,
  normalizeAiTrainingFocus,
  summarizeRecentTrainingIntensity,
} from "@/lib/ai";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import { optionalNumber, optionalString, requiredString } from "@/lib/forms";
import { rateLimit } from "@/lib/rate-limit";
import { assertProFeature } from "@/lib/billing";
import type { TrainingIntensity, TrainingPhaseType } from "@/lib/types";
import { revalidatePath } from "next/cache";

const AI_USER_DAILY_LIMIT = 10;
const AI_WORKSPACE_DAILY_LIMIT = 20;
const AI_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;

export async function createAiTrainingDraft(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  await assertProFeature(team.id, "KI-Trainingsplanung");
  const focus = requiredString(formData, "focus", "Schwerpunkt");
  const duration = optionalNumber(formData, "duration_minutes") ?? 90;
  const ageGroup = optionalString(formData, "age_group") ?? team.ageGroup;
  const date = requiredString(formData, "date", "Datum");

  if (focus.length > 120 || (ageGroup?.length ?? 0) > 40) {
    throw new Error("Schwerpunkt oder Altersstufe ist zu lang.");
  }
  if (!Number.isInteger(duration) || duration < 30 || duration > 240) {
    throw new Error("Die Trainingsdauer muss zwischen 30 und 240 Minuten liegen.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Das Trainingsdatum ist ungültig.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert. Bitte in .env.local setzen.");
  }

  const [userLimit, workspaceLimit] = await Promise.all([
    rateLimit(
      `ai-draft-user:${user.id}`,
      AI_USER_DAILY_LIMIT,
      AI_LIMIT_WINDOW_SECONDS
    ),
    rateLimit(
      `ai-draft-workspace:${team.id}`,
      AI_WORKSPACE_DAILY_LIMIT,
      AI_LIMIT_WINDOW_SECONDS
    )
  ]);
  if (!userLimit.success || !workspaceLimit.success) {
    throw new Error(
      "Das tägliche KI-Kontingent ist erreicht. Bitte morgen erneut versuchen."
    );
  }

  const trainingDate = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(trainingDate.getTime()) ||
    trainingDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Das Trainingsdatum ist ungültig.");
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [players, checkins, recentTrainings, nextMatch] = await Promise.all([
    db.player.findMany({
      where: { workspaceId: team.id },
      select: {
        id: true,
        status: true,
      },
    }),
    db.healthCheck.findMany({
      where: {
        player: { workspaceId: team.id },
        date: { gte: sevenDaysAgo },
      },
      orderBy: { date: "desc" },
      select: {
        playerId: true,
        fatigue: true,
        sleepQuality: true,
        soreness: true,
        pain: true,
        stress: true,
        motivation: true,
        energy: true,
        injuryFeeling: true,
        wellbeing: true,
      },
    }),
    db.training.findMany({
      where: {
        workspaceId: team.id,
        date: { lt: trainingDate },
      },
      orderBy: { date: "desc" },
      take: 4,
      select: {
        intensity: true,
      },
    }),
    db.match.findFirst({
      where: {
        workspaceId: team.id,
        date: { gte: trainingDate },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
      },
    }),
  ]);

  const teamLoadSummary = aggregateTeamLoadSignals(players, checkins);
  const recentTrainingSummary = summarizeRecentTrainingIntensity(recentTrainings);
  const daysUntilNextMatch = nextMatch
    ? Math.max(0, Math.round((nextMatch.date.getTime() - trainingDate.getTime()) / 86400000))
    : null;

  const plan = await generateTrainingPlan({
    ...teamLoadSummary,
    ...recentTrainingSummary,
    ageGroup: normalizeAiAgeGroup(ageGroup),
    durationMinutes: duration,
    focusCategory: normalizeAiTrainingFocus(focus),
    daysUntilNextMatch,
  });

  const validIntensities: TrainingIntensity[] = ["low", "medium", "high"];
  const intensity: TrainingIntensity = validIntensities.includes(plan.intensity as TrainingIntensity)
    ? (plan.intensity as TrainingIntensity)
    : "medium";

  const training = await db.training.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: plan.focus || focus,
      date: trainingDate,
      durationMinutes: duration,
      focus: plan.focus || focus,
      goal: plan.goal,
      intensity,
      notes: plan.notes,
    },
  });

  const phaseRows = (plan.phases ?? []).map((phase, index) => ({
    trainingId: training.id,
    phaseType: (phase.phase_type ?? "technique") as TrainingPhaseType,
    title: phase.title ?? "",
    durationMinutes: phase.duration_minutes ?? null,
    description: phase.description ?? null,
    coachingPoints: phase.coaching_points ?? null,
    organization: phase.organization ?? null,
    material: phase.material ?? null,
    variations: phase.variations ?? null,
    loadManagement: phase.load_management ?? null,
    diagram: (phase.diagram ?? null) as never,
    sortOrder: index,
  }));

  if (phaseRows.length > 0) {
    await db.trainingPhase.createMany({
      data: phaseRows,
    });
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}
