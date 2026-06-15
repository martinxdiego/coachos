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

export async function createTeam(formData: FormData) {
  const { user } = await requireUser();

  const name = requiredString(formData, "name", "Workspace name");
  const season = optionalString(formData, "season");
  const ageGroup = optionalString(formData, "age_group");

  const workspace = await db.workspace.create({
    data: {
      name,
      season,
      ageGroup,
      members: {
        create: {
          userId: user.id,
          role: "OWNER"
        }
      }
    }
  });

  await setActiveTeamCookie(workspace.id);
  revalidatePath("/");
  redirect("/");
}

export async function updateTeam(formData: FormData) {
  const { team, membership } = await requireActiveTeam();

  if (!canManageWorkspace(membership.role)) {
    throw new Error("Only lead coaches can update workspace settings.");
  }

  await db.workspace.update({
    where: { id: team.id },
    data: {
      name: requiredString(formData, "name", "Workspace name"),
      season: optionalString(formData, "season"),
      ageGroup: optionalString(formData, "age_group"),
      pointsLabel: optionalString(formData, "points_label"),
      awardsLabel: optionalString(formData, "awards_label"),
      linksLabel: optionalString(formData, "links_label")
    }
  });

  revalidatePath("/", "layout");
  revalidatePath("/workspaces");
}

export async function createTeamInvite(formData: FormData) {
  const { user, team, membership } = await requireActiveTeam();

  if (!canManageWorkspace(membership.role)) {
    throw new Error("Only lead coaches can invite staff members.");
  }

  const role = enumValue(formData, "role", ["coach", "assistant"] as const);
  if (!role) {
    throw new Error("Invite role is required.");
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.teamInvite.create({
    data: {
      workspaceId: team.id,
      code: inviteCode(),
      role,
      createdBy: user.id,
      expiresAt: expiresAt
    }
  });

  revalidatePath("/workspaces");
}

export async function joinTeamWithInvite(formData: FormData) {
  const { user } = await requireUser();
  const code = requiredString(formData, "code", "Invite code").toUpperCase();

  try {
    const teamId = await db.$transaction(async (tx) => {
      const invite = await tx.teamInvite.findUnique({
        where: { code }
      });

      if (!invite) {
        throw new Error("UngÃ¼ltiger Einladungscode.");
      }

      if (invite.expiresAt < new Date()) {
        throw new Error("Dieser Einladungscode ist abgelaufen.");
      }

      if (invite.usedAt) {
        throw new Error("Dieser Einladungscode wurde bereits verwendet.");
      }

      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id
          }
        }
      });

      if (existingMember) {
        return invite.workspaceId;
      }

      let parsedRole: Role = "ASSISTANT";
      if (invite.role === "coach") {
        parsedRole = "COACH";
      }

      await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: parsedRole
        }
      });

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() }
      });

      return invite.workspaceId;
    });

    if (teamId) {
      await setActiveTeamCookie(teamId);
    }
  } catch (err: any) {
    redirectWithMessage("/workspaces", err.message);
  }

  revalidatePath("/");
  redirect("/");
}

// PLAYER CRUD ACTIONS
