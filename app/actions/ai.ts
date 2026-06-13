"use server";

import { generateTrainingPlan } from "@/lib/ai";
import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { healthRisk } from "@/lib/coach-metrics";
import { ACTIVE_TEAM_COOKIE, requireActiveTeam, requireUser } from "@/lib/auth";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { rotatePlayerSignupInvite } from "@/lib/invites";
import {
  enumValue,
  normalizeExternalUrl,
  optionalNumber,
  optionalScaleFive,
  optionalString,
  requiredRating,
  requiredString,
  scaleFive
} from "@/lib/forms";
import { cacheDel } from "@/lib/redis";
import type {
  AttendanceStatus,
  CoachMessageCategory,
  EvaluationContextType,
  ExternalLinkType,
  HealthContextType,
  HomeAway,
  Json,
  MaterialType,
  MondayAttendanceStatus,
  PlayerStatus,
  StrongFoot,
  TrainingIntensity,
  TrainingPhaseType,
  WinnerPointContextType
} from "@/lib/types";
import type { Role } from "@prisma/client";
import {
  phaseTypes,
  trainingPresets,
  redirectWithMessage,
  canManageWorkspace,
  inviteCode,
  playerName,
  splitPlayerImportLine,
  looksLikePlayerImportHeader,
  setActiveTeamCookie,
  PLAYER_PHOTO_BUCKET,
  PLAYER_PHOTO_MAX_BYTES,
  PLAYER_PHOTO_MIME_TYPES,
  pathFromPublicUrl,
  TRAINING_IMAGE_BUCKET,
  TRAINING_IMAGE_MAX_BYTES,
  TRAINING_IMAGE_MAX_PER_PHASE,
  TRAINING_IMAGE_MIME_TYPES,
  trainingPayload,
  phaseRows,
  matchPayload,
  tacticRosterPositions,
  tacticRosterPosition,
  tacticInitials,
  tacticRosterElements,
  splitImportLine,
  looksLikeMatchImportHeader
} from "./_shared";

export async function createAiTrainingDraft(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const focus = requiredString(formData, "focus", "Schwerpunkt");
  const duration = optionalNumber(formData, "duration_minutes") ?? 90;
  const ageGroup = optionalString(formData, "age_group") ?? team.ageGroup;
  const date = requiredString(formData, "date", "Datum");
  const additionalContext = optionalString(formData, "context") ?? "";

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert. Bitte in .env.local setzen.");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [players, checkins, recentTrainings, nextMatch] = await Promise.all([
    db.player.findMany({
      where: { workspaceId: team.id },
      orderBy: { name: "asc" }
    }),
    db.healthCheck.findMany({
      where: {
        player: { workspaceId: team.id },
        date: { gte: sevenDaysAgo }
      },
      orderBy: { date: "desc" }
    }),
    db.training.findMany({
      where: {
        workspaceId: team.id,
        date: { lt: new Date(date) }
      },
      orderBy: { date: "desc" },
      take: 4
    }),
    db.match.findFirst({
      where: {
        workspaceId: team.id,
        date: { gte: new Date(date) }
      },
      orderBy: { date: "asc" }
    })
  ]);

  const latestByPlayer = new Map<string, typeof checkins[number]>();
  for (const c of checkins) {
    if (!latestByPlayer.has(c.playerId)) {
      latestByPlayer.set(c.playerId, c);
    }
  }

  const available = players.filter((p: any) => p.status === "available" || !p.status);
  const limited = players.filter((p: any) => p.status === "limited");
  const injured = players.filter((p: any) => p.status === "injured");

  const wellnessLines = players
    .map((player: any) => {
      const c = latestByPlayer.get(player.id);
      if (!c) return `- ${player.name}: Kein aktueller Check-in`;

      const snakeCaseCheckin = {
        player_id: c.playerId,
        checkin_date: c.date.toISOString().slice(0, 10),
        fatigue: c.fatigue,
        sleep_quality: c.sleepQuality ?? 3,
        soreness: c.soreness,
        pain: c.pain,
        stress: c.stress,
        motivation: c.motivation,
        energy: c.energy ?? 3,
        injury_feeling: c.injuryFeeling ?? 3,
        wellbeing: c.wellbeing ?? 3,
      };

      const risk = healthRisk(snakeCaseCheckin);
      const label =
        risk === "red"
          ? "ðŸ”´ ROT â€“ unbedingt schonen!"
          : risk === "yellow"
            ? "ðŸŸ¡ GELB â€“ beobachten"
            : "âœ… GUT";
      return `- ${player.name}: MÃ¼digkeit ${c.fatigue}/5, Schmerzen ${c.pain}/5, Energie ${c.energy ?? 3}/5, Stress ${c.stress}/5, Schlaf ${c.sleepQuality ?? 3}/5 â†’ ${label}`;
    })
    .join("\n");

  const recentLines =
    recentTrainings.length > 0
      ? recentTrainings.map((t: any) => `- ${t.date.toISOString().slice(0, 10)}: ${t.focus} (${t.intensity ?? "?"} IntensitÃ¤t)`).join("\n")
      : "- Noch keine Trainings erfasst";

  const daysToMatch = nextMatch
    ? Math.round((new Date(nextMatch.date).getTime() - new Date(date).getTime()) / 86400000)
    : null;
  const matchLine = nextMatch
    ? `${nextMatch.date.toISOString().slice(0, 10)} gegen ${nextMatch.opponent}${nextMatch.kickoffTime ? ` Â· Anpfiff ${nextMatch.kickoffTime.slice(0, 5)} Uhr` : ""} â€” ${daysToMatch} Tag(e) bis zum Spiel`
    : "Kein Spiel in den nÃ¤chsten 14 Tagen geplant";

  const plan = await generateTrainingPlan({
    teamName: team.name,
    ageGroup,
    totalPlayers: players.length,
    availableCount: available.length,
    limitedCount: limited.length,
    injuredCount: injured.length,
    date,
    durationMinutes: duration,
    focus,
    additionalContext,
    wellnessLines,
    recentLines,
    matchLine
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
      date: new Date(date),
      durationMinutes: duration,
      duration: duration,
      focus: plan.focus || focus,
      goal: plan.goal,
      intensity,
      notes: plan.notes
    }
  });

  const phaseRows = (plan.phases ?? []).map((phase: any, index: number) => ({
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
    diagram: (phase.diagram ?? null) as any,
    sortOrder: index
  }));

  if (phaseRows.length > 0) {
    await db.trainingPhase.createMany({
      data: phaseRows
    });
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

