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

export async function createTask(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const dueDateStr = optionalString(formData, "due_date");

  await db.task.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: requiredString(formData, "title", "Task"),
      dueDate: dueDateStr ? new Date(dueDateStr) : null,
      relatedType: optionalString(formData, "related_type")
    }
  });

  revalidatePath("/");
  revalidatePath("/pitch");
}

export async function toggleTask(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Task");
  const status = enumValue(formData, "status", ["open", "done"] as const);

  const task = await db.task.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!task) {
    throw new Error("Task not found or unauthorized.");
  }

  await db.task.update({
    where: { id },
    data: { status: status === "done" ? "open" : "done" }
  });

  revalidatePath("/");
  revalidatePath("/pitch");
}

export async function addFeedback(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const player = await db.player.findFirst({
    where: { id: playerId, workspaceId: team.id }
  });

  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.playerFeedback.create({
    data: {
      workspaceId: team.id,
      playerId: playerId,
      rating: requiredRating(formData),
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
}

