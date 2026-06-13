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

export async function createPlayer(formData: FormData) {
  const { team } = await requireActiveTeam();
  const { firstName, lastName, name } = playerName(formData);

  await db.player.create({
    data: {
      workspaceId: team.id,
      name,
      firstName,
      lastName,
      position: optionalString(formData, "position"),
      birthYear: optionalNumber(formData, "birth_year"),
      jerseyNumber: optionalNumber(formData, "jersey_number")
    }
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function importPlayers(formData: FormData) {
  const { team } = await requireActiveTeam();
  const raw = requiredString(formData, "players_csv", "Player list");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => index !== 0 || !looksLikePlayerImportHeader(line));

  const rows = lines.flatMap((line) => {
    const columns = splitPlayerImportLine(line);
    if (columns.length === 0) {
      return [];
    }

    const [firstColumn, secondColumn, position, birthYear, jerseyNumber] = columns;
    const fallbackParts = firstColumn.split(/\s+/).filter(Boolean);
    const firstName = secondColumn ? firstColumn : fallbackParts[0];
    const lastName = secondColumn
      ? secondColumn
      : fallbackParts.slice(1).join(" ") || "-";
    const name = `${firstName} ${lastName}`.trim();
    const parsedBirthYear = birthYear ? Number(birthYear) : null;
    const parsedJerseyNumber = jerseyNumber ? Number(jerseyNumber) : null;

    return [
      {
        workspaceId: team.id,
        name,
        firstName,
        lastName,
        position: position || null,
        birthYear:
          parsedBirthYear !== null && Number.isFinite(parsedBirthYear)
            ? parsedBirthYear
            : null,
        jerseyNumber:
          parsedJerseyNumber !== null && Number.isFinite(parsedJerseyNumber)
            ? parsedJerseyNumber
            : null
      }
    ];
  });

  if (rows.length === 0) {
    throw new Error("No players found in import.");
  }

  await db.player.createMany({
    data: rows
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function updatePlayer(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Player");
  const { firstName, lastName, name } = playerName(formData);
  const strongFoot = enumValue(formData, "strong_foot", [
    "left",
    "right",
    "both"
  ] as const) as StrongFoot | null;
  const status = enumValue(formData, "status", [
    "available",
    "injured",
    "limited",
    "absent"
  ] as const) as PlayerStatus | null;

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });
  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.player.update({
    where: { id },
    data: {
      name,
      firstName,
      lastName,
      position: optionalString(formData, "position"),
      secondaryPositions:
        optionalString(formData, "secondary_positions")
          ?.split(",")
          .map((item) => item.trim())
          .filter(Boolean) ?? [],
      birthDate: optionalString(formData, "birth_date") ? new Date(optionalString(formData, "birth_date")!) : null,
      birthYear: optionalNumber(formData, "birth_year"),
      jerseyNumber: optionalNumber(formData, "jersey_number"),
      photoUrl: optionalString(formData, "photo_url"),
      strongFoot,
      height: optionalNumber(formData, "height_cm"),
      weight: optionalNumber(formData, "weight_kg"),
      contact: optionalString(formData, "contact"),
      parentContact: optionalString(formData, "parent_contact"),
      emergencyContact: optionalString(formData, "emergency_contact"),
      playerAccountEmail: optionalString(formData, "player_account_email")?.toLowerCase() ?? null,
      favoriteTeam: optionalString(formData, "favorite_team"),
      favoritePlayer: optionalString(formData, "favorite_player"),
      footballGoals: optionalString(formData, "football_goals"),
      motivation: optionalString(formData, "motivation"),
      allergies: optionalString(formData, "allergies"),
      injuries: optionalString(formData, "injuries"),
      limitations: optionalString(formData, "limitations"),
      medications: optionalString(formData, "medications"),
      coachAlerts: optionalString(formData, "coach_alerts"),
      seasonFormCompletedAt:
        formData.get("season_form_completed") === "on"
          ? new Date()
          : null,
      medicalNotes: optionalString(formData, "medical_notes"),
      strengths: optionalString(formData, "strengths"),
      weaknesses: optionalString(formData, "weaknesses"),
      developmentGoals: optionalString(formData, "development_goals"),
      trainingNotes: optionalString(formData, "training_notes"),
      personalNotes: optionalString(formData, "personal_notes"),
      notes: optionalString(formData, "notes"),
      status: status ?? "available",
      rating: optionalNumber(formData, "rating")
    }
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  revalidatePath("/tactics");
}

export async function deletePlayer(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Player");

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.player.delete({
    where: { id }
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function rotatePlayerAccessToken(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Player");

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });
  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  // Issuing a fresh token immediately invalidates the previous share link
  // (e.g. when a link leaked in a family chat).
  await db.player.update({
    where: { id },
    data: { accessToken: randomUUID() }
  });

  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  revalidatePath("/player-mode");
}

export async function rotateTeamSignupCode() {
  const { team, user } = await requireActiveTeam();
  await rotatePlayerSignupInvite(team.id, user.id);
  revalidatePath("/players");
}


export async function uploadPlayerPhoto(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte wÃ¤hle ein Bild aus.");
  }
  if (file.size > PLAYER_PHOTO_MAX_BYTES) {
    throw new Error("Bild ist zu groÃŸ (max 6 MB).");
  }
  if (file.type && !PLAYER_PHOTO_MIME_TYPES.has(file.type)) {
    throw new Error("Nur JPG, PNG, WEBP oder HEIC sind erlaubt.");
  }

  const player = await db.player.findFirst({
    where: { id: playerId, workspaceId: team.id },
    select: { id: true, photoUrl: true }
  });

  if (!player) {
    throw new Error("Spieler nicht gefunden.");
  }

  const extFromName = file.name.split(".").pop()?.toLowerCase();
  const extFromMime = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const ext =
    extFromName && /^[a-z0-9]+$/.test(extFromName) && extFromName.length <= 5
      ? extFromName
      : extFromMime;
  const path = `${team.id}/${playerId}-${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${ext}`
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .getPublicUrl(path);

  try {
    await db.player.update({
      where: { id: playerId },
      data: { photoUrl: publicUrlData.publicUrl }
    });
  } catch (updateError: any) {
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([path]);
    throw new Error(updateError.message);
  }

  if (player.photoUrl) {
    const oldPath = pathFromPublicUrl(player.photoUrl, PLAYER_PHOTO_BUCKET);
    if (oldPath && oldPath !== path) {
      await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([oldPath]);
    }
  }

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/tactics");
  revalidatePath("/pitch");
}

export async function removePlayerPhoto(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const player = await db.player.findFirst({
    where: { id: playerId, workspaceId: team.id },
    select: { id: true, photoUrl: true }
  });

  if (!player) {
    throw new Error("Spieler nicht gefunden.");
  }
  if (!player.photoUrl) {
    return;
  }

  const oldPath = pathFromPublicUrl(player.photoUrl, PLAYER_PHOTO_BUCKET);
  const supabase = await createClient();
  if (oldPath) {
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([oldPath]);
  }

  await db.player.update({
    where: { id: playerId },
    data: { photoUrl: null }
  });

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/tactics");
  revalidatePath("/pitch");
}


export async function submitPlayerSeasonForm(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "player_id", "Player");
  const strongFoot = enumValue(formData, "strong_foot", [
    "left",
    "right",
    "both"
  ] as const) as StrongFoot | null;

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.player.update({
    where: { id },
    data: {
      strongFoot,
      contact: optionalString(formData, "contact"),
      parentContact: optionalString(formData, "parent_contact"),
      emergencyContact: optionalString(formData, "emergency_contact"),
      favoriteTeam: optionalString(formData, "favorite_team"),
      favoritePlayer: optionalString(formData, "favorite_player"),
      footballGoals: optionalString(formData, "football_goals"),
      motivation: optionalString(formData, "motivation"),
      strengths: optionalString(formData, "strengths"),
      weaknesses: optionalString(formData, "weaknesses"),
      allergies: optionalString(formData, "allergies"),
      injuries: optionalString(formData, "injuries"),
      limitations: optionalString(formData, "limitations"),
      medications: optionalString(formData, "medications"),
      seasonFormCompletedAt: new Date()
    }
  });

  revalidatePath("/player-mode");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
}

