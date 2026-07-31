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
  requireMatchInWorkspace,
  requirePlayersInWorkspace
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

export async function createPlayerAward(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const requestedPreviousPlayerId = optionalString(
    formData,
    "previous_player_id"
  );
  const matchId = optionalString(formData, "match_id");

  await Promise.all([
    requirePlayersInWorkspace(
      team.id,
      [playerId, requestedPreviousPlayerId].filter(
        (id): id is string => Boolean(id)
      )
    ),
    matchId ? requireMatchInWorkspace(team.id, matchId) : Promise.resolve()
  ]);

  const latest = await db.award.findFirst({
    where: { workspaceId: team.id },
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" }
    ],
    select: { playerId: true }
  });

  await db.award.create({
    data: {
      workspaceId: team.id,
      playerId,
      previousPlayerId:
        requestedPreviousPlayerId ?? latest?.playerId ?? null,
      matchId,
      eventLabel: optionalString(formData, "event_label"),
      event: optionalString(formData, "event_label") ?? "Man of the Week",
      date: new Date(optionalString(formData, "award_date") ?? new Date().toISOString().slice(0, 10)),
      reason: optionalString(formData, "reason")
    }
  });

  revalidatePath("/");
  revalidatePath("/awards");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updatePlayerAward(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Award");
  const playerId = requiredString(formData, "player_id", "Player");
  const previousPlayerId = optionalString(formData, "previous_player_id");
  const matchId = optionalString(formData, "match_id");

  await Promise.all([
    requirePlayersInWorkspace(
      team.id,
      [playerId, previousPlayerId].filter(
        (candidate): candidate is string => Boolean(candidate)
      )
    ),
    matchId ? requireMatchInWorkspace(team.id, matchId) : Promise.resolve()
  ]);

  const award = await db.award.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!award) {
    throw new Error("Award not found or unauthorized.");
  }

  await db.award.update({
    where: { id },
    data: {
      playerId,
      previousPlayerId,
      matchId,
      eventLabel: optionalString(formData, "event_label"),
      event: optionalString(formData, "event_label") ?? "Man of the Week",
      date: new Date(optionalString(formData, "award_date") ?? new Date().toISOString().slice(0, 10)),
      reason: optionalString(formData, "reason")
    }
  });

  revalidatePath("/");
  revalidatePath("/awards");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deletePlayerAward(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Award");

  const award = await db.award.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!award) {
    throw new Error("Award not found or unauthorized.");
  }

  await db.award.delete({
    where: { id }
  });

  revalidatePath("/awards");
  revalidatePath(`/players/${award.playerId}`);
}
