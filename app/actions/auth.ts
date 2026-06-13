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

export async function signIn(formData: FormData) {
  const email = requiredString(formData, "email", "Email");
  const password = requiredString(formData, "password", "Password");

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: "/"
    });
  } catch (error: any) {
    if (error.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithMessage("/login", "UngÃ¼ltige E-Mail-Adresse oder Passwort.");
  }
}

export async function signUp(formData: FormData) {
  const email = requiredString(formData, "email", "Email").toLowerCase();
  const password = requiredString(formData, "password", "Password");

  if (password.length < 10) {
    redirectWithMessage("/login", "Das Passwort muss mindestens 10 Zeichen lang sein.");
  }

  try {
    const existingUser = await db.user.findUnique({ where: { email } });

    if (existingUser) {
      redirectWithMessage("/login", "Ein Benutzer mit dieser E-Mail existiert bereits.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.user.create({
      data: { email, passwordHash, role: "COACH" },
    });

    redirectWithMessage("/login", "Registrierung erfolgreich. Bitte melde dich an.");
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("[signUp] error:", err?.code, err?.message, err);
    redirectWithMessage("/login", "Registrierung fehlgeschlagen â€“ bitte versuche es erneut.");
  }
}

export async function signOut() {
  await nextAuthSignOut({ redirectTo: "/login" });
}

export async function setActiveTeam(formData: FormData) {
  const { user } = await requireUser();
  const teamId = requiredString(formData, "team_id", "Workspace");

  const member = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: teamId,
        userId: user.id
      }
    }
  });

  if (!member) {
    throw new Error("Unauthorized to access this workspace.");
  }

  await setActiveTeamCookie(teamId);
  revalidatePath("/");
  redirect("/");
}

