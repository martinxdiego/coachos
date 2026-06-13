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

export async function addWinnerPoints(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "other",
    "monday_training"
  ] as const) as WinnerPointContextType | null;
  const points = optionalNumber(formData, "points");

  if (!contextType) {
    throw new Error("Context type is required.");
  }

  if (!points || points < 1 || points > 50) {
    throw new Error("Winnerpunkte must be between 1 and 50.");
  }

  const awardedAtStr = optionalString(formData, "awarded_at") ?? new Date().toISOString().slice(0, 10);
  const dateObj = new Date(`${awardedAtStr}T00:00:00`);

  const contextMap: Record<WinnerPointContextType, "TRAINING" | "MATCH" | "EVENT"> = {
    training: "TRAINING",
    monday_training: "TRAINING",
    match: "MATCH",
    event: "EVENT",
    other: "EVENT"
  };

  await db.winnerPoint.create({
    data: {
      workspaceId: team.id,
      playerId,
      context: contextMap[contextType] ?? "TRAINING",
      contextType,
      contextId: optionalString(formData, "context_id"),
      contextLabel: optionalString(formData, "context_label"),
      points,
      reason: optionalString(formData, "reason"),
      date: dateObj,
      awardedAt: dateObj
    }
  });

  await cacheDel(`leaderboard:${team.id}:points`);

  revalidatePath("/");
  revalidatePath("/points");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updateWinnerPoints(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Winnerpunkte");
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "other",
    "monday_training"
  ] as const) as WinnerPointContextType | null;
  const points = optionalNumber(formData, "points");

  if (!contextType) {
    throw new Error("Context type is required.");
  }

  if (!points || points < 1 || points > 50) {
    throw new Error("Winnerpunkte must be between 1 and 50.");
  }

  const awardedAtStr = optionalString(formData, "awarded_at") ?? new Date().toISOString().slice(0, 10);
  const dateObj = new Date(`${awardedAtStr}T00:00:00`);

  const contextMap: Record<WinnerPointContextType, "TRAINING" | "MATCH" | "EVENT"> = {
    training: "TRAINING",
    monday_training: "TRAINING",
    match: "MATCH",
    event: "EVENT",
    other: "EVENT"
  };

  const wp = await db.winnerPoint.findFirst({
    where: {
      id,
      workspaceId: team.id
    }
  });

  if (!wp) {
    throw new Error("WinnerPoint not found.");
  }

  await db.winnerPoint.update({
    where: { id },
    data: {
      playerId,
      context: contextMap[contextType] ?? "TRAINING",
      contextType,
      contextId: optionalString(formData, "context_id"),
      contextLabel: optionalString(formData, "context_label"),
      points,
      reason: optionalString(formData, "reason"),
      date: dateObj,
      awardedAt: dateObj
    }
  });

  await cacheDel(`leaderboard:${team.id}:points`);

  revalidatePath("/");
  revalidatePath("/points");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deleteWinnerPoints(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Winnerpunkte");
  const playerId = optionalString(formData, "player_id");

  const wp = await db.winnerPoint.findFirst({
    where: {
      id,
      workspaceId: team.id
    }
  });

  if (!wp) {
    throw new Error("WinnerPoint not found.");
  }

  await db.winnerPoint.delete({
    where: { id }
  });

  await cacheDel(`leaderboard:${team.id}:points`);

  revalidatePath("/");
  revalidatePath("/points");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

