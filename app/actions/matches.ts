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

export async function createMatch(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const payload = matchPayload(formData);

  await db.match.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      opponent: payload.opponent,
      date: new Date(payload.date),
      competition: payload.competition,
      kickoffTime: payload.kickoff_time,
      location: payload.location,
      home: payload.home_away === "home",
      homeAway: payload.home_away,
      meetingPoint: payload.meeting_point,
      squadNotes: payload.squad_notes,
      startingLineup: payload.starting_lineup,
      substitutes: payload.substitutes,
      formation: payload.formation,
      tacticalInstructions: payload.tactical_instructions,
      matchGoals: payload.match_goals,
      preMatchNotes: payload.pre_match_notes,
      halftimeNotes: payload.halftime_notes,
      postMatchNotes: payload.post_match_notes,
      result: payload.result,
      scorers: payload.scorers,
      assists: payload.assists,
      cards: payload.cards,
      conclusion: payload.conclusion,
      notes: payload.notes
    }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

export async function updateMatch(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Match");

  const match = await db.match.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!match) {
    throw new Error("Match not found or unauthorized.");
  }

  const payload = matchPayload(formData);

  await db.match.update({
    where: { id },
    data: {
      opponent: payload.opponent,
      date: new Date(payload.date),
      competition: payload.competition,
      kickoffTime: payload.kickoff_time,
      location: payload.location,
      home: payload.home_away === "home",
      homeAway: payload.home_away,
      meetingPoint: payload.meeting_point,
      squadNotes: payload.squad_notes,
      startingLineup: payload.starting_lineup,
      substitutes: payload.substitutes,
      formation: payload.formation,
      tacticalInstructions: payload.tactical_instructions,
      matchGoals: payload.match_goals,
      preMatchNotes: payload.pre_match_notes,
      halftimeNotes: payload.halftime_notes,
      postMatchNotes: payload.post_match_notes,
      result: payload.result,
      scorers: payload.scorers,
      assists: payload.assists,
      cards: payload.cards,
      conclusion: payload.conclusion,
      notes: payload.notes
    }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

export async function deleteMatch(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Match");

  const match = await db.match.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!match) {
    throw new Error("Match not found or unauthorized.");
  }

  await db.match.delete({
    where: { id }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}


export async function saveMatchAnalysis(formData: FormData) {
  const { team } = await requireActiveTeam();
  const matchId = requiredString(formData, "match_id", "Match");

  const match = await db.match.findFirst({
    where: { id: matchId, workspaceId: team.id }
  });

  if (!match) {
    throw new Error("Match not found or unauthorized.");
  }

  const opponentAnalysis = optionalString(formData, "opponent_analysis");
  const preparation = optionalString(formData, "match_preparation");
  const matchTargets = optionalString(formData, "match_targets");
  const lineupNotes = optionalString(formData, "lineup_notes");
  const wentWell = optionalString(formData, "went_well");
  const needsWork = optionalString(formData, "needs_work");
  const keyMoments = optionalString(formData, "key_moments");
  const individualPerformances = optionalString(formData, "individual_performances");
  const teamPerformance = optionalString(formData, "team_performance");
  const tacticalLessons = optionalString(formData, "tactical_lessons");
  const nextTrainingFocus = optionalString(formData, "next_training_focus");

  await db.matchAnalysis.upsert({
    where: { matchId },
    create: {
      matchId,
      opponentAnalysis,
      preparation,
      matchTargets,
      lineupNotes,
      wentWell,
      needsWork,
      keyMoments,
      individualPerformances,
      teamPerformance,
      tacticalLessons,
      nextTrainingFocus
    },
    update: {
      opponentAnalysis,
      preparation,
      matchTargets,
      lineupNotes,
      wentWell,
      needsWork,
      keyMoments,
      individualPerformances,
      teamPerformance,
      tacticalLessons,
      nextTrainingFocus
    }
  });

  revalidatePath("/analysis");
  revalidatePath("/matches");
}


export async function importMatches(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const uploaded = formData.get("matches_file");
  let raw = optionalString(formData, "matches_csv") ?? "";

  if (
    typeof File !== "undefined" &&
    uploaded instanceof File &&
    uploaded.size > 0
  ) {
    raw = await uploaded.text();
  }

  if (!raw.trim()) {
    throw new Error("No match data found.");
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => index !== 0 || !looksLikeMatchImportHeader(line));

  const rows = lines.flatMap((line) => {
    const [date, opponent, kickoffTime, location, homeAway, competition, result, category] =
      splitImportLine(line);

    if (!date || !opponent) {
      return [];
    }

    return [
      {
        workspaceId: team.id,
        userId: user.id,
        date: new Date(date),
        opponent,
        kickoffTime: kickoffTime || null,
        location: location || null,
        home: homeAway === "home",
        homeAway: (["home", "away", "neutral"].includes(homeAway)
          ? homeAway
          : null),
        competition: competition || null,
        result: result || null
      }
    ];
  });

  if (rows.length === 0) {
    throw new Error("No valid matches found in import.");
  }

  await db.match.createMany({
    data: rows
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/analysis");
}

