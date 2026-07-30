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

export async function saveHealthCheckin(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "free"
  ] as const) as HealthContextType | null;

  const checkinDateStr = optionalString(formData, "checkin_date") ?? new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(checkinDateStr);
  const typeStr = contextType ?? "training";

  const fatigue = scaleFive(formData, "fatigue", "Fatigue");
  const sleep_quality = scaleFive(formData, "sleep_quality", "Sleep quality");
  const soreness = scaleFive(formData, "soreness", "Soreness");
  const pain = scaleFive(formData, "pain", "Pain");
  const stress = scaleFive(formData, "stress", "Stress");
  const motivation = scaleFive(formData, "motivation", "Motivation");
  const energy = scaleFive(formData, "energy", "Energy");
  const injury_feeling = scaleFive(formData, "injury_feeling", "Injury feeling");
  const wellbeing = scaleFive(formData, "wellbeing", "Wellbeing");
  const notes = optionalString(formData, "notes");

  await requirePlayerInWorkspace(team.id, playerId);

  const contextEnum =
    typeStr === "match"
      ? "PRE_MATCH"
      : typeStr === "training"
      ? "PRE_TRAINING"
      : "PRE_TRAINING";

  const existing = await db.healthCheck.findFirst({
    where: {
      playerId,
      date: parsedDate,
      contextType: typeStr
    }
  });

  if (existing) {
    await db.healthCheck.update({
      where: { id: existing.id },
      data: {
        fatigue,
        sleepQuality: sleep_quality,
        soreness,
        pain,
        stress,
        motivation,
        energy,
        injuryFeeling: injury_feeling,
        wellbeing,
        notes,
        context: contextEnum
      }
    });
  } else {
    await db.healthCheck.create({
      data: {
        playerId,
        date: parsedDate,
        contextType: typeStr,
        fatigue,
        sleepQuality: sleep_quality,
        soreness,
        pain,
        stress,
        motivation,
        energy,
        injuryFeeling: injury_feeling,
        wellbeing,
        notes,
        context: contextEnum
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updateHealthCheckin(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Health check-in");
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "free"
  ] as const) as HealthContextType | null;

  const checkinDateStr = optionalString(formData, "checkin_date") ?? new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(checkinDateStr);
  const typeStr = contextType ?? "training";

  await requirePlayerInWorkspace(team.id, playerId);

  const checkin = await db.healthCheck.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!checkin) {
    throw new Error("Health check-in not found or unauthorized");
  }

  const fatigue = scaleFive(formData, "fatigue", "Fatigue");
  const sleep_quality = scaleFive(formData, "sleep_quality", "Sleep quality");
  const soreness = scaleFive(formData, "soreness", "Soreness");
  const pain = scaleFive(formData, "pain", "Pain");
  const stress = scaleFive(formData, "stress", "Stress");
  const motivation = scaleFive(formData, "motivation", "Motivation");
  const energy = scaleFive(formData, "energy", "Energy");
  const injury_feeling = scaleFive(formData, "injury_feeling", "Injury feeling");
  const wellbeing = scaleFive(formData, "wellbeing", "Wellbeing");
  const notes = optionalString(formData, "notes");

  const contextEnum =
    typeStr === "match"
      ? "PRE_MATCH"
      : typeStr === "training"
      ? "PRE_TRAINING"
      : "PRE_TRAINING";

  await db.healthCheck.update({
    where: { id },
    data: {
      playerId,
      date: parsedDate,
      contextType: typeStr,
      fatigue,
      sleepQuality: sleep_quality,
      soreness,
      pain,
      stress,
      motivation,
      energy,
      injuryFeeling: injury_feeling,
      wellbeing,
      notes,
      context: contextEnum
    }
  });

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deleteHealthCheckin(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Health check-in");

  const checkin = await db.healthCheck.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!checkin) {
    throw new Error("Health check-in not found or unauthorized");
  }

  await db.healthCheck.delete({
    where: { id }
  });

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${checkin.playerId}`);
}

