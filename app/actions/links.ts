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

export async function createExternalLink(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const linkType = enumValue(formData, "link_type", [
    "clubcorner",
    "player_stats",
    "quali_document",
    "meeting_notes",
    "medical",
    "other"
  ] as const) as ExternalLinkType | null;
  const rawUrl = requiredString(formData, "url", "URL");

  if (!linkType) {
    throw new Error("Link type is required.");
  }

  const url = normalizeExternalUrl(rawUrl);
  const playerId = optionalString(formData, "player_id");

  await db.externalLink.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      playerId: playerId || null,
      linkType: linkType,
      title: requiredString(formData, "title", "Title"),
      url,
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function updateExternalLink(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Link");
  const linkType = enumValue(formData, "link_type", [
    "clubcorner",
    "player_stats",
    "quali_document",
    "meeting_notes",
    "medical",
    "other"
  ] as const) as ExternalLinkType | null;
  const playerId = optionalString(formData, "player_id");

  if (!linkType) {
    throw new Error("Link type is required.");
  }

  const existing = await db.externalLink.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!existing) {
    throw new Error("Link not found or unauthorized.");
  }

  await db.externalLink.update({
    where: { id },
    data: {
      playerId: playerId || null,
      linkType: linkType,
      title: requiredString(formData, "title", "Title"),
      url: normalizeExternalUrl(requiredString(formData, "url", "URL")),
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function deleteExternalLink(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Link");
  const playerId = optionalString(formData, "player_id");

  const existing = await db.externalLink.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!existing) {
    throw new Error("Link not found or unauthorized.");
  }

  await db.externalLink.delete({
    where: { id }
  });

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

