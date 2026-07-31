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

export async function createDemoTeam() {
  const { user } = await requireUser();
  await assertCanCreateWorkspace(user.id);

  const day = 24 * 60 * 60 * 1000;
  const now = new Date();
  const trainingDate = new Date(now.getTime() + 2 * day);
  const matchDate = new Date(now.getTime() + 5 * day);
  const demoPlayers = [
    ["Noah", "Keller", 1, "Torhüter"],
    ["Liam", "Meier", 2, "Rechter Aussenverteidiger"],
    ["Levin", "Huber", 3, "Linker Aussenverteidiger"],
    ["Milan", "Frei", 4, "Innenverteidiger"],
    ["Elia", "Bühler", 5, "Innenverteidiger"],
    ["Luca", "Zimmermann", 6, "Defensives Mittelfeld"],
    ["Jan", "Steiner", 7, "Rechter Flügel"],
    ["Nico", "Brunner", 8, "Zentrales Mittelfeld"],
    ["Finn", "Schmid", 9, "Stürmer"],
    ["Elias", "Müller", 10, "Offensives Mittelfeld"],
    ["Dario", "Graf", 11, "Linker Flügel"],
    ["Ben", "Roth", 12, "Torhüter"],
    ["Louis", "Kunz", 14, "Innenverteidiger"],
    ["Mats", "Wyss", 15, "Mittelfeld"],
    ["Jamie", "Suter", 17, "Stürmer"]
  ] as const;

  const workspace = await db.$transaction(async (tx) => {
    const createdWorkspace = await tx.workspace.create({
      data: {
        name: "CoachOS Demo-Team",
        season: "2026/2027",
        ageGroup: "U17",
        members: { create: { userId: user.id, role: "OWNER" } }
      }
    });

    const players = await Promise.all(
      demoPlayers.map(([firstName, lastName, jerseyNumber, position], index) =>
        tx.player.create({
          data: {
            workspaceId: createdWorkspace.id,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            jerseyNumber,
            position,
            birthYear: 2009,
            status: index === 13 ? "LIMITED" : "AVAILABLE",
            consentAcceptedAt: now,
            consentVersion: "demo"
          }
        })
      )
    );

    const training = await tx.training.create({
      data: {
        workspaceId: createdWorkspace.id,
        userId: user.id,
        title: "Spielaufbau gegen hohes Pressing",
        focus: trainingPresets.buildup.focus,
        goal: trainingPresets.buildup.goal,
        date: trainingDate,
        startTime: "18:30",
        durationMinutes: 90,
        intensity: "medium",
        location: "Hauptplatz",
        phases: {
          create: trainingPresets.buildup.phases.map(
            ([phaseType, title, durationMinutes, description], index) => ({
              phaseType,
              title,
              durationMinutes,
              description,
              sortOrder: index
            })
          )
        }
      }
    });

    const match = await tx.match.create({
      data: {
        workspaceId: createdWorkspace.id,
        userId: user.id,
        opponent: "FC Beispielstadt",
        competition: "Meisterschaft",
        date: matchDate,
        kickoffTime: "14:00",
        meetingPoint: "12:45",
        location: "Stadion Demo",
        homeAway: "home",
        formation: "4-2-3-1",
        matchGoals: "Mutig eröffnen, Zentrum überladen und nach Ballverlust sofort reagieren."
      }
    });

    await tx.tacticBoard.create({
      data: {
        workspaceId: createdWorkspace.id,
        userId: user.id,
        title: "Aufbau 4-2-3-1",
        description: "Ein gefülltes Board als Ausgangspunkt für deine eigene Animation.",
        elements: {
          version: 2,
          scenes: [
            {
              id: "scene-1",
              name: "Grundordnung",
              elements: [
                ...tacticRosterElements(
                  players.map((player) => ({
                    id: player.id,
                    name: player.name,
                    position: player.position,
                    jersey_number: player.jerseyNumber
                  }))
                ),
                { id: "demo-ball", type: "ball", label: "", x: 20, y: 50 }
              ]
            }
          ]
        }
      }
    });

    await Promise.all([
      tx.task.create({
        data: {
          workspaceId: createdWorkspace.id,
          userId: user.id,
          title: "Zu- und Absagen fürs Spiel prüfen",
          dueDate: new Date(matchDate.getTime() - day)
        }
      }),
      tx.healthCheck.create({
        data: {
          playerId: players[13].id,
          date: now,
          fatigue: 4,
          sleepQuality: 2,
          soreness: 3,
          pain: 2,
          stress: 3,
          motivation: 4,
          energy: 2,
          injuryFeeling: 2,
          wellbeing: 3,
          notes: "Demo-Check-in"
        }
      }),
      tx.playerFeedback.create({
        data: {
          workspaceId: createdWorkspace.id,
          playerId: players[9].id,
          rating: 8,
          notes: "Ich möchte im nächsten Training den ersten Kontakt unter Druck üben."
        }
      }),
      ...players.slice(0, 7).map((player, index) =>
        tx.availabilityResponse.create({
          data: {
            workspaceId: createdWorkspace.id,
            playerId: player.id,
            eventType: "TRAINING",
            eventId: training.id,
            status: index === 6 ? "MAYBE" : "YES"
          }
        })
      ),
      ...players.slice(0, 5).map((player) =>
        tx.availabilityResponse.create({
          data: {
            workspaceId: createdWorkspace.id,
            playerId: player.id,
            eventType: "MATCH",
            eventId: match.id,
            status: "YES"
          }
        })
      )
    ]);

    return createdWorkspace;
  });

  await setActiveTeamCookie(workspace.id);
  revalidatePath("/", "layout");
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
