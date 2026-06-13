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

export async function uploadPhaseImage(formData: FormData) {
  const { team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Trainingsphase");
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte wÃ¤hle ein Bild aus.");
  }
  if (file.size > TRAINING_IMAGE_MAX_BYTES) {
    throw new Error("Bild ist zu groÃŸ (max 8 MB).");
  }
  if (file.type && !TRAINING_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Nur JPG, PNG, WEBP, GIF oder HEIC sind erlaubt.");
  }

  const phase = await db.trainingPhase.findFirst({
    where: { id: phaseId, training: { workspaceId: team.id } },
    select: { id: true, trainingId: true, imageUrls: true }
  });

  if (!phase) {
    throw new Error("Trainingsphase nicht gefunden.");
  }

  const currentImages = phase.imageUrls ?? [];
  if (currentImages.length >= TRAINING_IMAGE_MAX_PER_PHASE) {
    throw new Error(
      `Maximal ${TRAINING_IMAGE_MAX_PER_PHASE} Bilder pro Phase.`
    );
  }

  const extFromName = file.name.split(".").pop()?.toLowerCase();
  const extFromMime =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const ext =
    extFromName && /^[a-z0-9]+$/.test(extFromName) && extFromName.length <= 5
      ? extFromName
      : extFromMime;
  const path = `${team.id}/${phase.trainingId}/${phaseId}-${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(TRAINING_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${ext}`
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(TRAINING_IMAGE_BUCKET)
    .getPublicUrl(path);

  const nextImages = [...currentImages, publicUrlData.publicUrl];

  try {
    await db.trainingPhase.update({
      where: { id: phaseId },
      data: { imageUrls: nextImages }
    });
  } catch (updateError: any) {
    await supabase.storage.from(TRAINING_IMAGE_BUCKET).remove([path]);
    throw new Error(updateError.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function removePhaseImage(formData: FormData) {
  const { team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Trainingsphase");
  const imageUrl = requiredString(formData, "image_url", "Bild-URL");

  const phase = await db.trainingPhase.findFirst({
    where: { id: phaseId, training: { workspaceId: team.id } },
    select: { id: true, imageUrls: true }
  });

  if (!phase) {
    throw new Error("Trainingsphase nicht gefunden.");
  }

  const currentImages = phase.imageUrls ?? [];
  if (!currentImages.includes(imageUrl)) {
    return;
  }
  const nextImages = currentImages.filter((url: string) => url !== imageUrl);

  await db.trainingPhase.update({
    where: { id: phaseId },
    data: { imageUrls: nextImages }
  });

  const path = pathFromPublicUrl(imageUrl, TRAINING_IMAGE_BUCKET);
  if (path) {
    const supabase = await createClient();
    await supabase.storage.from(TRAINING_IMAGE_BUCKET).remove([path]);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}


export async function createTraining(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const payload = trainingPayload(formData);

  const training = await db.training.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: payload.focus,
      ...payload
    }
  });

  const rows = phaseRows(formData, training.id);
  if (rows.length > 0) {
    await db.trainingPhase.createMany({
      data: rows
    });
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function updateTraining(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Training");

  const existingTraining = await db.training.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!existingTraining) {
    throw new Error("Training not found or unauthorized.");
  }

  const payload = trainingPayload(formData);

  await db.training.update({
    where: { id },
    data: {
      title: payload.focus,
      ...payload
    }
  });

  const existingPhases = await db.trainingPhase.findMany({
    where: { trainingId: id },
    select: { phaseType: true, imageUrls: true }
  });

  const imagesByType = new Map<TrainingPhaseType, string[]>();
  for (const row of existingPhases ?? []) {
    if (row.imageUrls && row.imageUrls.length > 0) {
      imagesByType.set(row.phaseType as TrainingPhaseType, row.imageUrls);
    }
  }

  await db.trainingPhase.deleteMany({
    where: { trainingId: id }
  });

  const rows = phaseRows(formData, id, imagesByType);
  if (rows.length > 0) {
    await db.trainingPhase.createMany({
      data: rows
    });
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}


export async function deleteTrainingWeek(formData: FormData) {
  const { team } = await requireActiveTeam();
  const ids = formData.getAll("training_id") as string[];
  if (ids.length === 0) return;

  await db.training.deleteMany({
    where: {
      id: { in: ids },
      workspaceId: team.id
    }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trainings");
}

export async function updatePhaseDiagram(formData: FormData) {
  const { team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Phase");
  const diagramJson = requiredString(formData, "diagram", "Diagramm");
  let diagram: unknown;
  try {
    diagram = JSON.parse(diagramJson);
  } catch {
    throw new Error("UngÃ¼ltiges Diagramm-Format");
  }

  const phase = await db.trainingPhase.findFirst({
    where: { id: phaseId, training: { workspaceId: team.id } }
  });

  if (!phase) {
    throw new Error("Phase nicht gefunden oder unauthorized");
  }

  await db.trainingPhase.update({
    where: { id: phaseId },
    data: { diagram: diagram as any }
  });

  revalidatePath("/trainings");
}

export async function updateTrainingPhase(formData: FormData) {
  const { team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Phase");

  const phase = await db.trainingPhase.findFirst({
    where: { id: phaseId, training: { workspaceId: team.id } }
  });

  if (!phase) {
    throw new Error("Phase nicht gefunden oder unauthorized");
  }

  await db.trainingPhase.update({
    where: { id: phaseId },
    data: {
      title: optionalString(formData, "title") ?? undefined,
      durationMinutes: optionalNumber(formData, "duration_minutes"),
      description: optionalString(formData, "description"),
      coachingPoints: optionalString(formData, "coaching_points"),
      organization: optionalString(formData, "organization"),
      material: optionalString(formData, "material"),
      playerCount: optionalString(formData, "player_count"),
      fieldSize: optionalString(formData, "field_size"),
      variations: optionalString(formData, "variations"),
      loadManagement: optionalString(formData, "load_management")
    }
  });

  revalidatePath("/trainings");
}

export async function reorderPhase(formData: FormData) {
  const { team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Phase");
  const direction = formData.get("direction") as "up" | "down";

  const phase = await db.trainingPhase.findFirst({
    where: { id: phaseId, training: { workspaceId: team.id } },
    select: { id: true, sortOrder: true, trainingId: true }
  });
  if (!phase) throw new Error("Phase nicht gefunden");

  const siblings = await db.trainingPhase.findMany({
    where: { trainingId: phase.trainingId },
    select: { id: true, sortOrder: true },
    orderBy: { sortOrder: "asc" }
  });
  if (!siblings || siblings.length < 2) return;

  const idx = siblings.findIndex((s: { id: string }) => s.id === phaseId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;

  const swapWith = siblings[swapIdx];

  await db.$transaction([
    db.trainingPhase.update({
      where: { id: phaseId },
      data: { sortOrder: swapWith.sortOrder }
    }),
    db.trainingPhase.update({
      where: { id: swapWith.id },
      data: { sortOrder: phase.sortOrder }
    })
  ]);

  revalidatePath("/trainings");
}

export async function duplicateTraining(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Training");

  const training = await db.training.findFirst({
    where: { id, workspaceId: team.id },
    include: {
      phases: {
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!training) {
    throw new Error("Training not found or unauthorized.");
  }

  const clone = await db.training.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: `${training.focus} copy`,
      date: training.date,
      startTime: training.startTime,
      durationMinutes: training.durationMinutes,
      location: training.location,
      focus: `${training.focus} copy`,
      goal: training.goal,
      intensity: training.intensity,
      participants: training.participants,
      notes: training.notes,
      isTemplate: false
    }
  });

  const phaseClones = (training.phases ?? []).map((phase: any) => ({
    trainingId: clone.id,
    phaseType: phase.phaseType,
    title: phase.title,
    durationMinutes: phase.durationMinutes,
    description: phase.description,
    coachingPoints: phase.coachingPoints,
    organization: phase.organization,
    material: phase.material,
    playerCount: phase.playerCount,
    fieldSize: phase.fieldSize,
    variations: phase.variations,
    loadManagement: phase.loadManagement,
    imageUrls: phase.imageUrls ?? [],
    sortOrder: phase.sortOrder
  }));

  if (phaseClones.length > 0) {
    await db.trainingPhase.createMany({
      data: phaseClones
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function deleteTraining(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Training");

  const training = await db.training.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!training) {
    throw new Error("Training not found or unauthorized.");
  }

  await db.training.delete({
    where: { id }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}


export async function createPresetTraining(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const presetKey = requiredString(formData, "preset", "Preset");
  const preset = trainingPresets[presetKey as keyof typeof trainingPresets];

  if (!preset) {
    throw new Error("Unknown training preset.");
  }

  const date = requiredString(formData, "date", "Training date");
  const duration = optionalNumber(formData, "duration_minutes") ?? 90;
  const phaseTotal = preset.phases.reduce((sum, phase) => sum + phase[2], 0);

  const training = await db.training.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: preset.focus,
      date: new Date(date),
      durationMinutes: duration,
      location: optionalString(formData, "location"),
      focus: preset.focus,
      goal: preset.goal,
      intensity: preset.intensity,
      notes:
        "Vorlage aus der CoachOS-Bibliothek. Passe Phasen, Belastung und Coachingpunkte an dein Team an."
    }
  });

  const rows = preset.phases.map(([phaseType, title, minutes, description], index) => ({
    trainingId: training.id,
    phaseType: phaseType as TrainingPhaseType,
    title,
    durationMinutes: Math.max(5, Math.round((minutes / phaseTotal) * duration)),
    description,
    coachingPoints:
      "Timing, AbstÃ¤nde, Kommunikation und EntscheidungsqualitÃ¤t aktiv coachen.",
    organization:
      "FeldgrÃ¶ÃŸe und Spielerzahl an KadergrÃ¶ÃŸe anpassen; klare Wechsel- und Pausenregeln setzen.",
    material: "BÃ¤lle, HÃ¼tchen, Markierungsteller, Leibchen, Tore",
    playerCount: "12-18",
    fieldSize: "Variabel",
    variations:
      "Leichter: mehr Raum und freie Kontakte. Schwerer: Kontaktlimit, Zeitdruck oder kleinere Zonen.",
    loadManagement:
      preset.intensity === "high"
        ? "Kurze intensive BlÃ¶cke mit klaren Pausen."
        : "Mittlere Belastung mit flieÃŸenden ÃœbergÃ¤ngen.",
    sortOrder: index
  }));

  if (rows.length > 0) {
    await db.trainingPhase.createMany({
      data: rows
    });
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function saveAttendance(formData: FormData) {
  const { team } = await requireActiveTeam();
  const trainingId = requiredString(formData, "training_id", "Training");
  const playerIds = formData.getAll("player_id").map(String);
  const presentIds = new Set(formData.getAll("present_player_id").map(String));

  const players = await db.player.findMany({
    where: {
      workspaceId: team.id,
      id: { in: playerIds }
    },
    select: { id: true }
  });

  const rows = players.map((player) => {
    const status: AttendanceStatus = presentIds.has(player.id)
      ? "present"
      : "absent";

    return {
      trainingId,
      playerId: player.id,
      status
    };
  });

  for (const row of rows) {
    await db.attendance.upsert({
      where: {
        trainingId_playerId: {
          trainingId: row.trainingId,
          playerId: row.playerId
        }
      },
      create: {
        trainingId: row.trainingId,
        playerId: row.playerId,
        status: row.status
      },
      update: {
        status: row.status
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

