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
import { requirePlayerInWorkspace } from "@/lib/team-relations";
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

export async function createCoachMessage(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const body = requiredString(formData, "body", "Body");
  const title = optionalString(formData, "title");
  const category = (enumValue(formData, "category", [
    "training_goal",
    "match_goal",
    "note",
    "praise"
  ] as const) ?? "note") as CoachMessageCategory;

  await requirePlayerInWorkspace(team.id, playerId);

  const fullBody = title ? `**${title}**\n\n${body}` : body;

  await db.coachMessage.create({
    data: {
      workspaceId: team.id,
      playerId,
      userId: user.id,
      category,
      body: fullBody
    }
  });

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/");
}

export async function deleteCoachMessage(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Message");

  const message = await db.coachMessage.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!message) {
    throw new Error("Message not found or unauthorized.");
  }

  await db.coachMessage.delete({
    where: { id }
  });

  revalidatePath(`/players/${message.playerId}`);
  revalidatePath("/");
}

