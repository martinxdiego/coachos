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
  requireContextInWorkspace,
  requirePlayerInWorkspace
} from "@/lib/team-relations";
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

export async function savePlayerEvaluation(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "monday_training"
  ] as const) as EvaluationContextType | null;

  if (!contextType) {
    throw new Error("Evaluation context is required.");
  }

  const contextId = optionalString(formData, "context_id");
  await Promise.all([
    requirePlayerInWorkspace(team.id, playerId),
    requireContextInWorkspace(team.id, contextType, contextId)
  ]);

  const row = {
    team_id: team.id,
    user_id: user.id,
    player_id: playerId,
    context_type: contextType,
    context_id: contextId,
    context_label: optionalString(formData, "context_label"),
    evaluation_date: optionalString(formData, "evaluation_date") ?? new Date().toISOString().slice(0, 10),
    participation: optionalScaleFive(formData, "participation"),
    motivation: optionalScaleFive(formData, "motivation"),
    training_quality: optionalScaleFive(formData, "training_quality"),
    match_quality: optionalScaleFive(formData, "match_quality"),
    behavior: optionalScaleFive(formData, "behavior"),
    effort: optionalScaleFive(formData, "effort"),
    concentration: optionalScaleFive(formData, "concentration"),
    notes: optionalString(formData, "notes")
  };

  const hasScore = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].some((value) => value !== null);

  if (!hasScore) {
    throw new Error("At least one score is required.");
  }

  const scores = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].filter((v): v is number => v !== null);
  const average = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : null;

  let contextEnum: "TRAINING" | "MATCH" | "EVENT" = "TRAINING";
  if (contextType === "match") {
    contextEnum = "MATCH";
  } else if (contextType === "event") {
    contextEnum = "EVENT";
  }

  await db.rating.create({
    data: {
      playerId: row.player_id,
      raterId: row.user_id,
      date: new Date(row.evaluation_date),
      context: contextEnum,
      contextType: row.context_type,
      contextId: row.context_id,
      contextLabel: row.context_label,
      participation: row.participation,
      motivation: row.motivation,
      trainingQuality: row.training_quality,
      matchQuality: row.match_quality,
      behavior: row.behavior,
      effort: row.effort,
      concentration: row.concentration,
      notes: row.notes,
      average: average,
    }
  });

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updatePlayerEvaluation(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Evaluation");
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "monday_training"
  ] as const) as EvaluationContextType | null;

  if (!contextType) {
    throw new Error("Evaluation context is required.");
  }

  const contextId = optionalString(formData, "context_id");
  await Promise.all([
    requirePlayerInWorkspace(team.id, playerId),
    requireContextInWorkspace(team.id, contextType, contextId)
  ]);

  const row = {
    player_id: playerId,
    context_type: contextType,
    context_id: contextId,
    context_label: optionalString(formData, "context_label"),
    evaluation_date:
      optionalString(formData, "evaluation_date") ??
      new Date().toISOString().slice(0, 10),
    participation: optionalScaleFive(formData, "participation"),
    motivation: optionalScaleFive(formData, "motivation"),
    training_quality: optionalScaleFive(formData, "training_quality"),
    match_quality: optionalScaleFive(formData, "match_quality"),
    behavior: optionalScaleFive(formData, "behavior"),
    effort: optionalScaleFive(formData, "effort"),
    concentration: optionalScaleFive(formData, "concentration"),
    notes: optionalString(formData, "notes")
  };

  const hasScore = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].some((value) => value !== null);

  if (!hasScore) {
    throw new Error("At least one score is required.");
  }

  const rating = await db.rating.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!rating) {
    throw new Error("Evaluation not found or unauthorized");
  }

  const scores = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].filter((v): v is number => v !== null);
  const average = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : null;

  let contextEnum: "TRAINING" | "MATCH" | "EVENT" = "TRAINING";
  if (contextType === "match") {
    contextEnum = "MATCH";
  } else if (contextType === "event") {
    contextEnum = "EVENT";
  }

  await db.rating.update({
    where: { id },
    data: {
      playerId: row.player_id,
      date: new Date(row.evaluation_date),
      context: contextEnum,
      contextType: row.context_type,
      contextId: row.context_id,
      contextLabel: row.context_label,
      participation: row.participation,
      motivation: row.motivation,
      trainingQuality: row.training_quality,
      matchQuality: row.match_quality,
      behavior: row.behavior,
      effort: row.effort,
      concentration: row.concentration,
      notes: row.notes,
      average: average,
    }
  });

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deletePlayerEvaluation(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Evaluation");

  const rating = await db.rating.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!rating) {
    throw new Error("Evaluation not found or unauthorized");
  }

  await db.rating.delete({
    where: { id }
  });

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${rating.playerId}`);
}

