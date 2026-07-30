"use server";

import { generateTrainingPlan } from "@/lib/ai";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "crypto";
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
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmailVerificationEmail } from "@/lib/transactional-email";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_WINDOW_SECONDS = 60 * 60;

function verificationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function equalSecret(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", code: "missing_fields" };
  }
  if (
    email.length > 254 ||
    password.length > 128 ||
    !EMAIL_PATTERN.test(email)
  ) {
    return { status: "error", code: "invalid_credentials" };
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
  const signupCode = String(formData.get("signup_code") ?? "").trim();

  if (!email || !password || !signupCode) {
    return { status: "error", code: "missing_fields" };
  }
  if (password.length < 10) {
    return { status: "error", code: "password_too_short" };
  }
  if (
    email.length > 254 ||
    password.length > 128 ||
    signupCode.length > 128 ||
    !EMAIL_PATTERN.test(email)
  ) {
    return { status: "error", code: "signup_failed" };
  }

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  const [ipLimit, emailLimit] = await Promise.all([
    rateLimit(`coach-signup-ip:${clientIp}`, 10, SIGNUP_WINDOW_SECONDS),
    rateLimit(`coach-signup-email:${email}`, 5, SIGNUP_WINDOW_SECONDS)
  ]);
  if (!ipLimit.success || !emailLimit.success) {
    return { status: "error", code: "signup_unavailable" };
  }

  // Pilot accounts are invite-only. This prevents public account creation
  // from becoming an AI/storage cost primitive before verified coach
  // onboarding exists.
  const expectedCode = process.env.COACH_SIGNUP_CODE;
  if (
    (process.env.NODE_ENV === "production" &&
      (!expectedCode || expectedCode.length < 16)) ||
    (expectedCode && !equalSecret(signupCode, expectedCode))
  ) {
    return { status: "error", code: "signup_unavailable" };
  }

  try {
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      // Do not reveal whether a coach account already exists.
      return { status: "success", code: "signup_success" };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = randomBytes(32).toString("base64url");
    await db.user.create({
      data: {
        email,
        passwordHash,
        role: "COACH",
        emailVerificationTokens: {
          create: {
            tokenHash: verificationTokenHash(verificationToken),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        }
      }
    });
    const verificationUrl = `${getSiteUrl()}/verify-email/${verificationToken}`;
    await sendEmailVerificationEmail(email, verificationUrl);

    return { status: "success", code: "signup_success" };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return { status: "success", code: "signup_success" };
    }
    logger.error("User registration failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error,
    });
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

