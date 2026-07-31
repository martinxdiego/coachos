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

export async function deleteTacticBoard(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Taktikboard");

  const board = await db.tacticBoard.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!board) {
    throw new Error("Tactic board not found or unauthorized.");
  }

  await db.tacticBoard.delete({
    where: { id }
  });

  revalidatePath("/tactics");
}


export async function createTacticBoard(formData: FormData) {
  const { user, team } = await requireActiveTeam();

  const players = await db.player.findMany({
    where: { workspaceId: team.id },
    select: { id: true, name: true, position: true, jerseyNumber: true },
    orderBy: [
      { jerseyNumber: "asc" },
      { name: "asc" }
    ]
  });

  const mappedPlayers = players.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    jersey_number: p.jerseyNumber
  }));

  const board = await db.tacticBoard.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: requiredString(formData, "title", "Board title"),
      description: optionalString(formData, "description"),
      elements: {
        version: 2,
        scenes: [
          {
            id: "scene-1",
            name: "Grundformation",
            elements: [
              ...tacticRosterElements(mappedPlayers),
              { id: "ball", type: "ball", label: "", x: 53, y: 58 }
            ]
          }
        ]
      }
    }
  });

  revalidatePath("/tactics");
  redirect(`/tactics/${board.id}`);
}

export async function saveTacticBoard(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Tactic board");
  const elementsRaw = requiredString(formData, "elements", "Board elements");

  let elements: unknown;
  try {
    elements = JSON.parse(elementsRaw);
  } catch {
    throw new Error("Board elements are invalid.");
  }

  const board = await db.tacticBoard.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!board) {
    throw new Error("Tactic board not found or unauthorized.");
  }

  await db.tacticBoard.update({
    where: { id },
    data: {
      title: requiredString(formData, "title", "Board title"),
      description: optionalString(formData, "description"),
      elements: elements as any
    }
  });

  revalidatePath("/tactics");
}

