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

async function buildMaterialContent(
  teamId: string,
  type: MaterialType,
  customContent: string | null
) {
  if (customContent) {
    return customContent;
  }

  if (type === "player_list" || type === "attendance_list") {
    const players = await db.player.findMany({
      where: { workspaceId: teamId },
      select: {
        name: true,
        position: true,
        birthYear: true,
        jerseyNumber: true,
        status: true
      },
      orderBy: { name: "asc" }
    });

    if (!players || players.length === 0) {
      return "Noch keine Spieler im Workspace.";
    }

    const mappedPlayers = players.map((player) => ({
      ...player,
      status: player.status.toLowerCase()
    }));

    if (type === "attendance_list") {
      return [
        "Anwesenheitsliste",
        "",
        ...mappedPlayers.map(
          (player, index) =>
            `[ ] ${index + 1}. ${player.name} | ${player.position ?? "-"} | #${player.jerseyNumber ?? "-"}`
        )
      ].join("\n");
    }

    return [
      "Spielerliste",
      "",
      "Nr. | Name | Position | Jahrgang | Status",
      "--- | --- | --- | --- | ---",
      ...mappedPlayers.map(
        (player) =>
          `${player.jerseyNumber ?? "-"} | ${player.name} | ${player.position ?? "-"} | ${player.birthYear ?? "-"} | ${player.status}`
      )
    ].join("\n");
  }

  if (type === "training_plan") {
    const training = await db.training.findFirst({
      where: { workspaceId: teamId },
      orderBy: { date: "desc" },
      include: {
        phases: {
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    if (!training) {
      return [
        "Trainingsplan",
        "",
        "Datum:",
        "Ziel:",
        "Schwerpunkt:",
        "",
        "Warm-up:",
        "Technik:",
        "Taktik:",
        "Spielform:",
        "Abschluss:",
        "Cooldown:"
      ].join("\n");
    }

    const dateStr = training.date.toISOString().slice(0, 10);
    return [
      `Trainingsplan: ${training.focus}`,
      `Datum: ${dateStr}${training.startTime ? ` ${training.startTime.slice(0, 5)}` : ""}`,
      `Ort: ${training.location ?? "-"}`,
      `Dauer: ${training.durationMinutes ?? "-"} Minuten`,
      `IntensitÃ¤t: ${training.intensity ?? "-"}`,
      "",
      `Ziel: ${training.goal ?? "-"}`,
      "",
      ...(training.phases ?? []).map(
        (phase) =>
          `${phase.title} (${phase.durationMinutes ?? "-"} Min)\n${phase.description ?? ""}\nCoaching: ${phase.coachingPoints ?? "-"}\nMaterial: ${phase.material ?? "-"}\n`
      )
    ].join("\n");
  }

  if (type === "match_plan") {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr);
    const match = await db.match.findFirst({
      where: {
        workspaceId: teamId,
        date: { gte: today }
      },
      orderBy: { date: "asc" }
    });

    if (!match) {
      return "Matchplan\n\nGegner:\nDatum:\nTreffpunkt:\nFormation:\nStartelf:\nTaktik:\nMatchziele:";
    }

    const matchDateStr = match.date.toISOString().slice(0, 10);
    return [
      `Matchplan: ${match.opponent}`,
      `Datum: ${matchDateStr}${match.kickoffTime ? ` ${match.kickoffTime.slice(0, 5)}` : ""}`,
      `Ort: ${match.location ?? "-"}`,
      `Treffpunkt: ${match.meetingPoint ?? "-"}`,
      `Formation: ${match.formation ?? "-"}`,
      "",
      "Startelf:",
      match.startingLineup ?? "-",
      "",
      "Ersatzspieler:",
      match.substitutes ?? "-",
      "",
      "Taktik:",
      match.tacticalInstructions ?? "-",
      "",
      "Matchziele:",
      match.matchGoals ?? "-"
    ].join("\n");
  }

  if (type === "week_plan" || type === "month_plan") {
    const limit = type === "week_plan" ? 10 : 40;
    const [trainings, matches] = await Promise.all([
      db.training.findMany({
        where: { workspaceId: teamId },
        select: {
          date: true,
          startTime: true,
          focus: true,
          location: true
        },
        orderBy: { date: "asc" },
        take: limit
      }),
      db.match.findMany({
        where: { workspaceId: teamId },
        select: {
          date: true,
          kickoffTime: true,
          opponent: true,
          location: true
        },
        orderBy: { date: "asc" },
        take: limit
      })
    ]);

    const events = [
      ...trainings.map(
        (event) =>
          `${event.date.toISOString().slice(0, 10)} ${event.startTime?.slice(0, 5) ?? ""} | Training | ${event.focus} | ${event.location ?? "-"}`
      ),
      ...matches.map(
        (event) =>
          `${event.date.toISOString().slice(0, 10)} ${event.kickoffTime?.slice(0, 5) ?? ""} | Spiel | ${event.opponent} | ${event.location ?? "-"}`
      )
    ].sort();

    return [
      type === "week_plan" ? "Wochenplan" : "Monatsplan",
      "",
      ...(events.length > 0 ? events : ["Noch keine Termine geplant."])
    ].join("\n");
  }

  if (type === "tactics_sheet") {
    return [
      "Taktikblatt",
      "",
      "Formation:",
      "Prinzipien:",
      "PressingauslÃ¶ser:",
      "Aufbau:",
      "Umschalten:",
      "Standards:"
    ].join("\n");
  }

  return [
    "Ãœbungsblatt",
    "",
    "Ziel:",
    "Organisation:",
    "Ablauf:",
    "Coachingpunkte:",
    "Varianten:",
    "Material:"
  ].join("\n");
}

export async function createMaterial(formData: FormData) {
  const { team, user } = await requireActiveTeam();
  const type = enumValue(formData, "type", [
    "exercise_sheet",
    "training_plan",
    "match_plan",
    "tactics_sheet",
    "player_list",
    "attendance_list",
    "week_plan",
    "month_plan"
  ] as const) as MaterialType | null;

  if (!type) {
    throw new Error("Material type is required.");
  }

  const content = await buildMaterialContent(
    team.id,
    type,
    optionalString(formData, "content")
  );

  await db.material.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      type,
      title: requiredString(formData, "title", "Title"),
      description: optionalString(formData, "description"),
      content
    }
  });

  revalidatePath("/");
  revalidatePath("/materials");
}

export async function updateMaterial(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Material");

  const material = await db.material.findFirst({
    where: {
      id,
      workspaceId: team.id
    }
  });

  if (!material) {
    throw new Error("Material not found or unauthorized");
  }

  await db.material.update({
    where: { id },
    data: {
      title: requiredString(formData, "title", "Title"),
      description: optionalString(formData, "description"),
      content: optionalString(formData, "content")
    }
  });

  revalidatePath("/materials");
}

export async function deleteMaterial(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Material");

  const material = await db.material.findFirst({
    where: {
      id,
      workspaceId: team.id
    }
  });

  if (!material) {
    throw new Error("Material not found or unauthorized");
  }

  await db.material.delete({
    where: { id }
  });

  revalidatePath("/materials");
}

type TacticRosterPlayer = {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
};

