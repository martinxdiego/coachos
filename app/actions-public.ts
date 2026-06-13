"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { resolvePlayerSignupInvite } from "@/lib/invites";
import type { HealthContextType, PlayerStatus } from "@/lib/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureUuid(value: string | null | undefined, label: string): string {
  if (!value || !UUID_RE.test(value)) {
    throw new Error(`${label} ist ungültig.`);
  }
  return value.toLowerCase();
}

function reqString(formData: FormData, key: string, label: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} ist erforderlich.`);
  return value;
}

function optString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function scaleFive(formData: FormData, key: string, label: string): number {
  const value = Number(formData.get(key));
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} muss zwischen 1 und 5 liegen.`);
  }
  return value;
}

async function findPlayerByToken(token: string) {
  const player = await db.player.findFirst({
    where: { accessToken: token },
    select: {
      id: true,
      workspaceId: true,
      accessToken: true,
      name: true,
      firstName: true,
      lastName: true,
    }
  });
  if (!player) throw new Error("Zugang ist ungültig.");
  return {
    id: player.id,
    team_id: player.workspaceId,
    access_token: player.accessToken,
    name: player.name,
    first_name: player.firstName,
    last_name: player.lastName,
  };
}

export interface SelfRegisterResult {
  ok: true;
  accessToken: string;
  playerId: string;
}

export async function selfRegisterPlayer(
  teamToken: string,
  formData: FormData
): Promise<SelfRegisterResult> {
  const invite = await resolvePlayerSignupInvite(teamToken);
  if (!invite) {
    throw new Error("Beitritts-Link ist ungültig oder abgelaufen.");
  }

  const firstName = reqString(formData, "first_name", "Vorname");
  const lastName = reqString(formData, "last_name", "Nachname");
  const birthDate = optString(formData, "birth_date");
  const birthYear = optNumber(formData, "birth_year");
  const heightCm = optNumber(formData, "height_cm");
  const weightKg = optNumber(formData, "weight_kg");
  const position = optString(formData, "position");
  const jerseyNumber = optNumber(formData, "jersey_number");

  const fullName = `${firstName} ${lastName}`.trim();

  const created = await db.player.create({
    data: {
      workspaceId: invite.workspaceId,
      name: fullName,
      firstName,
      lastName,
      birthDate: birthDate ? new Date(birthDate) : null,
      birthYear,
      height: heightCm,
      weight: weightKg,
      position,
      jerseyNumber,
      status: "AVAILABLE",
      selfRegisteredAt: new Date(),
    },
    select: {
      id: true,
      accessToken: true,
    }
  });

  revalidatePath("/players");
  revalidatePath("/");

  return {
    ok: true,
    accessToken: created.accessToken,
    playerId: created.id
  };
}

export async function submitPublicCheckin(
  accessToken: string,
  formData: FormData
) {
  const token = ensureUuid(accessToken, "Zugang");
  const player = await findPlayerByToken(token);

  const checkinDate =
    optString(formData, "checkin_date") ??
    new Date().toISOString().slice(0, 10);
  const contextRaw = optString(formData, "context_type") ?? "training";
  const contextType: HealthContextType =
    contextRaw === "match" || contextRaw === "free" ? contextRaw : "training";

  const fatigue = scaleFive(formData, "fatigue", "Müdigkeit");
  const sleep_quality = scaleFive(formData, "sleep_quality", "Schlafqualität");
  const soreness = scaleFive(formData, "soreness", "Muskelkater");
  const pain = scaleFive(formData, "pain", "Schmerzen");
  const stress = scaleFive(formData, "stress", "Stress");
  const motivation = scaleFive(formData, "motivation", "Motivation");
  const energy = scaleFive(formData, "energy", "Energie");
  const injury_feeling = scaleFive(formData, "injury_feeling", "Verletzungsgefühl");
  const wellbeing = scaleFive(formData, "wellbeing", "Wohlbefinden");
  const notes = optString(formData, "notes");

  const parsedDate = new Date(`${checkinDate}T00:00:00.000Z`);

  const contextEnum =
    contextType === "match"
      ? "PRE_MATCH"
      : "PRE_TRAINING";

  const existing = await db.healthCheck.findFirst({
    where: {
      playerId: player.id,
      date: parsedDate,
      contextType: contextType
    }
  });

  if (existing) {
    await db.healthCheck.update({
      where: { id: existing.id },
      data: {
        fatigue,
        sleepQuality: sleep_quality,
        soreness,
        pain,
        stress,
        motivation,
        energy,
        injuryFeeling: injury_feeling,
        wellbeing,
        notes,
        context: contextEnum
      }
    });
  } else {
    await db.healthCheck.create({
      data: {
        playerId: player.id,
        date: parsedDate,
        contextType: contextType,
        fatigue,
        sleepQuality: sleep_quality,
        soreness,
        pain,
        stress,
        motivation,
        energy,
        injuryFeeling: injury_feeling,
        wellbeing,
        notes,
        context: contextEnum
      }
    });
  }

  revalidatePath(`/spieler/${token}`);
  revalidatePath("/health");
  revalidatePath("/");
  revalidatePath(`/players/${player.id}`);
}

async function findTeamCreatedBy(teamId: string): Promise<string | null> {
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: teamId },
    select: { userId: true }
  });
  return member?.userId ?? null;
}

export async function submitPublicSeasonForm(
  accessToken: string,
  formData: FormData
) {
  const token = ensureUuid(accessToken, "Zugang");
  const player = await findPlayerByToken(token);

  await db.player.update({
    where: { id: player.id },
    data: {
      contact: optString(formData, "contact"),
      parentContact: optString(formData, "parent_contact"),
      emergencyContact: optString(formData, "emergency_contact"),
      strongFoot: optString(formData, "strong_foot"),
      favoriteTeam: optString(formData, "favorite_team"),
      favoritePlayer: optString(formData, "favorite_player"),
      footballGoals: optString(formData, "football_goals"),
      strengths: optString(formData, "strengths"),
      weaknesses: optString(formData, "weaknesses"),
      motivation: optString(formData, "motivation"),
      allergies: optString(formData, "allergies"),
      injuries: optString(formData, "injuries"),
      limitations: optString(formData, "limitations"),
      medications: optString(formData, "medications"),
      seasonFormCompletedAt: new Date()
    }
  });

  revalidatePath(`/spieler/${token}`);
  revalidatePath(`/players/${player.id}`);
}

export async function submitPlayerNoteToCoach(
  accessToken: string,
  formData: FormData
) {
  const token = ensureUuid(accessToken, "Zugang");
  const player = await findPlayerByToken(token);
  const body = reqString(formData, "body", "Notiz");
  const ratingRaw = String(formData.get("rating") ?? "").trim();
  const rating = Number(ratingRaw);
  const safeRating =
    Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : 5;

  await db.playerFeedback.create({
    data: {
      workspaceId: player.team_id,
      playerId: player.id,
      rating: safeRating,
      notes: body
    }
  });

  revalidatePath(`/spieler/${token}`);
  revalidatePath(`/players/${player.id}`);
}

export async function markCoachMessageRead(
  accessToken: string,
  messageId: string
) {
  const token = ensureUuid(accessToken, "Zugang");
  const id = ensureUuid(messageId, "Mitteilungs-ID");
  const player = await findPlayerByToken(token);

  await db.coachMessage.update({
    where: { id },
    data: { readAt: new Date() }
  });

  revalidatePath(`/spieler/${token}`);
  revalidatePath(`/players/${player.id}`);
}
