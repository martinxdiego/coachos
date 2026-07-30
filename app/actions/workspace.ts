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
import { redeemStaffInvite } from "@/lib/staff-invites";
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
import {
  drainStorageDeletionQueueBestEffort,
  enqueueStorageDeletions
} from "@/lib/storage-deletion-queue";
import { recordAuditEvent } from "@/lib/audit";
import { assertCanCreateWorkspace } from "@/lib/billing";
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
  await assertCanCreateWorkspace(user.id);

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
  const { user, team, membership } = await requireActiveTeam();

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
  await recordAuditEvent({
    workspaceId: team.id,
    event: "workspace.settings.updated",
    actorUserId: user.id,
    targetType: "Workspace",
    targetId: team.id
  });

  revalidatePath("/", "layout");
  revalidatePath("/workspaces");
}

export async function deleteWorkspace(formData: FormData) {
  const { user, team, membership, teamOptions } = await requireActiveTeam();

  if (!canManageWorkspace(membership.role)) {
    throw new Error("Nur der Workspace-Owner darf den Workspace löschen.");
  }

  const confirmation = requiredString(
    formData,
    "workspace_name",
    "Workspace-Name"
  );
  if (confirmation !== team.name) {
    throw new Error("Der eingegebene Workspace-Name stimmt nicht überein.");
  }

  const password = requiredString(formData, "password", "Passwort");
  if (password.length > 128) {
    throw new Error("Das Passwort ist nicht korrekt.");
  }
  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    throw new Error("Das Passwort ist nicht korrekt.");
  }

  const deletionJobIds = await db.$transaction(async (tx) => {
    const [players, phases] = await Promise.all([
      tx.player.findMany({
        where: { workspaceId: team.id },
        select: { photoUrl: true }
      }),
      tx.trainingPhase.findMany({
        where: { training: { workspaceId: team.id } },
        select: { imageUrls: true }
      })
    ]);
    const playerPhotoJobs = await enqueueStorageDeletions(
      tx,
      team.id,
      PLAYER_PHOTO_BUCKET,
      players.map((player) => player.photoUrl)
    );
    const trainingImageJobs = await enqueueStorageDeletions(
      tx,
      team.id,
      TRAINING_IMAGE_BUCKET,
      phases.flatMap((phase) => phase.imageUrls)
    );

    await recordAuditEvent(
      {
        workspaceId: team.id,
        event: "workspace.deleted",
        actorUserId: user.id,
        targetType: "Workspace",
        targetId: team.id
      },
      tx
    );
    await tx.workspace.delete({ where: { id: team.id } });
    return [...playerPhotoJobs, ...trainingImageJobs];
  });

  await drainStorageDeletionQueueBestEffort({
    ids: deletionJobIds,
    limit: deletionJobIds.length || 1
  });

  const nextTeam = teamOptions.find((option) => option.team.id !== team.id);
  const cookieStore = await cookies();
  if (nextTeam) {
    await setActiveTeamCookie(nextTeam.team.id);
  } else {
    cookieStore.delete(ACTIVE_TEAM_COOKIE);
  }

  revalidatePath("/", "layout");
  redirectWithMessage(
    "/workspaces",
    `Workspace „${team.name}“ wurde dauerhaft gelöscht.`
  );
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
  await recordAuditEvent({
    workspaceId: team.id,
    event: "workspace.staff_invite.created",
    actorUserId: user.id,
    targetType: "TeamInvite"
  });

  revalidatePath("/workspaces");
}

export async function updateRetentionPolicy(formData: FormData) {
  const { user, team, membership } = await requireActiveTeam();
  if (!canManageWorkspace(membership.role)) {
    throw new Error("Nur der Workspace-Owner darf Aufbewahrungsregeln ändern.");
  }

  const dataRetentionDays = optionalNumber(formData, "data_retention_days");
  const healthRetentionDays = optionalNumber(
    formData,
    "health_retention_days"
  );
  if (
    !dataRetentionDays ||
    dataRetentionDays < 30 ||
    dataRetentionDays > 3650 ||
    !healthRetentionDays ||
    healthRetentionDays < 30 ||
    healthRetentionDays > 3650
  ) {
    throw new Error(
      "Aufbewahrungsfristen müssen zwischen 30 und 3650 Tagen liegen."
    );
  }

  await db.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: team.id },
      data: { dataRetentionDays, healthRetentionDays }
    });
    await recordAuditEvent(
      {
        workspaceId: team.id,
        event: "workspace.retention.updated",
        actorUserId: user.id,
        targetType: "Workspace",
        targetId: team.id,
        metadata: { dataRetentionDays, healthRetentionDays }
      },
      tx
    );
  });
  revalidatePath("/workspaces");
}

export async function joinTeamWithInvite(formData: FormData) {
  const { user } = await requireUser();
  const code = requiredString(formData, "code", "Invite code").toUpperCase();

  try {
    const teamId = await redeemStaffInvite(user.id, code);

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
