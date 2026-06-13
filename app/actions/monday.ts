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

export async function createMondayTraining(formData: FormData) {
  const { user, team } = await requireActiveTeam();

  await db.mondayTraining.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      date: new Date(requiredString(formData, "date", "Date")),
      topic: requiredString(formData, "topic", "Topic"),
      goal: optionalString(formData, "goal"),
      durationMinutes: optionalNumber(formData, "duration_minutes"),
      staffNotes: optionalString(formData, "staff_notes"),
      assistantNotes: optionalString(formData, "assistant_notes")
    }
  });

  revalidatePath("/monday");
}

export async function updateMondayTraining(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Monday training");

  const training = await db.mondayTraining.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!training) {
    throw new Error("Monday training not found or unauthorized.");
  }

  await db.mondayTraining.update({
    where: { id },
    data: {
      date: new Date(requiredString(formData, "date", "Date")),
      topic: requiredString(formData, "topic", "Topic"),
      goal: optionalString(formData, "goal"),
      durationMinutes: optionalNumber(formData, "duration_minutes"),
      staffNotes: optionalString(formData, "staff_notes"),
      assistantNotes: optionalString(formData, "assistant_notes")
    }
  });

  revalidatePath("/monday");
}

export async function deleteMondayTraining(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Monday training");

  const training = await db.mondayTraining.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!training) {
    throw new Error("Monday training not found or unauthorized.");
  }

  await db.mondayTraining.delete({
    where: { id }
  });

  revalidatePath("/monday");
}

export async function saveMondayAttendance(formData: FormData) {
  const { team } = await requireActiveTeam();
  const mondayTrainingId = requiredString(formData, "monday_training_id", "Monday training");
  const playerIds = formData.getAll("player_id").map(String);
  const presentIds = new Set(formData.getAll("present_player_id").map(String));
  const injuredIds = new Set(formData.getAll("injured_player_id").map(String));

  const training = await db.mondayTraining.findFirst({
    where: { id: mondayTrainingId, workspaceId: team.id }
  });

  if (!training) {
    throw new Error("Monday training not found or unauthorized.");
  }

  const rows = playerIds.map((playerId) => {
    const status: MondayAttendanceStatus = injuredIds.has(playerId)
      ? "injured"
      : presentIds.has(playerId)
        ? "present"
        : "absent";

    return {
      mondayTrainingId,
      playerId,
      status,
      note: optionalString(formData, `note_${playerId}`)
    };
  });

  for (const row of rows) {
    await db.mondayAttendance.upsert({
      where: {
        mondayTrainingId_playerId: {
          mondayTrainingId: row.mondayTrainingId,
          playerId: row.playerId
        }
      },
      create: {
        mondayTrainingId: row.mondayTrainingId,
        playerId: row.playerId,
        status: row.status,
        note: row.note
      },
      update: {
        status: row.status,
        note: row.note
      }
    });
  }

  revalidatePath("/monday");
}

