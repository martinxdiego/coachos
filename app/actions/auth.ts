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

// S6.4: Auth-Formulare geben einen serialisierbaren Zustand mit einem stabilen
// Code zurück (statt per ?message=-Redirect), damit der Client Fehler inline +
// als Toast anzeigen kann. Die Codes werden client-seitig übersetzt.
export type AuthFormState =
  | { status: "error"; code: string }
  | { status: "success"; code: string }
  | null;

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", code: "missing_fields" };
  }

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: "/"
    });
  } catch (error: any) {
    // Erfolg löst einen NEXT_REDIRECT aus — den durchreichen, damit Next
    // navigiert. Alles andere ist ein fehlgeschlagener Login (generisch,
    // verrät nicht, ob die E-Mail existiert — siehe S1.6).
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return { status: "error", code: "invalid_credentials" };
  }
  return null;
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", code: "missing_fields" };
  }
  if (password.length < 10) {
    return { status: "error", code: "password_too_short" };
  }

  try {
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return { status: "error", code: "email_exists" };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.user.create({
      data: { email, passwordHash, role: "COACH" },
    });

    return { status: "success", code: "signup_success" };
  } catch (err: any) {
    console.error("[signUp] error:", err?.code, err?.message);
    return { status: "error", code: "signup_failed" };
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

