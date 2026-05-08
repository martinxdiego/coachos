"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
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

async function findTeamByToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .select("id,name,age_group,player_signup_token,created_by")
    .eq("player_signup_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Beitritts-Link ist ungültig oder abgelaufen.");
  return data;
}

async function findPlayerByToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("players")
    .select("id,team_id,access_token,name,first_name,last_name")
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Zugang ist ungültig.");
  return data;
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
  const token = ensureUuid(teamToken, "Team-Token");
  const team = await findTeamByToken(token);

  const firstName = reqString(formData, "first_name", "Vorname");
  const lastName = reqString(formData, "last_name", "Nachname");
  const birthDate = optString(formData, "birth_date");
  const birthYear = optNumber(formData, "birth_year");
  const heightCm = optNumber(formData, "height_cm");
  const weightKg = optNumber(formData, "weight_kg");
  const position = optString(formData, "position");
  const jerseyNumber = optNumber(formData, "jersey_number");

  const fullName = `${firstName} ${lastName}`.trim();
  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("players")
    .insert({
      team_id: team.id,
      user_id: team.created_by,
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDate,
      birth_year: birthYear,
      height_cm: heightCm,
      weight_kg: weightKg,
      position,
      jersey_number: jerseyNumber,
      status: "available" as PlayerStatus,
      self_registered_at: new Date().toISOString()
    })
    .select("id,access_token")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/players");
  revalidatePath("/");

  return {
    ok: true,
    accessToken: created.access_token,
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

  const row = {
    team_id: player.team_id,
    user_id: (await findTeamCreatedBy(player.team_id)) ?? player.id,
    player_id: player.id,
    checkin_date: checkinDate,
    context_type: contextType,
    fatigue: scaleFive(formData, "fatigue", "Müdigkeit"),
    sleep_quality: scaleFive(formData, "sleep_quality", "Schlafqualität"),
    soreness: scaleFive(formData, "soreness", "Muskelkater"),
    pain: scaleFive(formData, "pain", "Schmerzen"),
    stress: scaleFive(formData, "stress", "Stress"),
    motivation: scaleFive(formData, "motivation", "Motivation"),
    energy: scaleFive(formData, "energy", "Energie"),
    injury_feeling: scaleFive(formData, "injury_feeling", "Verletzungsgefühl"),
    wellbeing: scaleFive(formData, "wellbeing", "Wohlbefinden"),
    notes: optString(formData, "notes")
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from("health_checkins")
    .upsert(row, { onConflict: "player_id,checkin_date,context_type" });

  if (error) throw new Error(error.message);

  revalidatePath(`/spieler/${token}`);
  revalidatePath("/health");
  revalidatePath("/");
  revalidatePath(`/players/${player.id}`);
}

async function findTeamCreatedBy(teamId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("teams")
    .select("created_by")
    .eq("id", teamId)
    .maybeSingle();
  return data?.created_by ?? null;
}

export async function submitPublicSeasonForm(
  accessToken: string,
  formData: FormData
) {
  const token = ensureUuid(accessToken, "Zugang");
  const player = await findPlayerByToken(token);

  const admin = createAdminClient();
  const { error } = await admin
    .from("players")
    .update({
      contact: optString(formData, "contact"),
      parent_contact: optString(formData, "parent_contact"),
      emergency_contact: optString(formData, "emergency_contact"),
      strong_foot:
        (optString(formData, "strong_foot") as
          | "left"
          | "right"
          | "both"
          | null) ?? null,
      favorite_team: optString(formData, "favorite_team"),
      favorite_player: optString(formData, "favorite_player"),
      football_goals: optString(formData, "football_goals"),
      strengths: optString(formData, "strengths"),
      weaknesses: optString(formData, "weaknesses"),
      motivation: optString(formData, "motivation"),
      allergies: optString(formData, "allergies"),
      injuries: optString(formData, "injuries"),
      limitations: optString(formData, "limitations"),
      medications: optString(formData, "medications"),
      season_form_completed_at: new Date().toISOString()
    })
    .eq("id", player.id);

  if (error) throw new Error(error.message);

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

  const admin = createAdminClient();
  const { error } = await admin.from("player_feedback").insert({
    team_id: player.team_id,
    player_id: player.id,
    user_id: (await findTeamCreatedBy(player.team_id)) ?? player.id,
    rating: safeRating,
    notes: body
  });

  if (error) throw new Error(error.message);

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

  const admin = createAdminClient();
  const { error } = await admin
    .from("coach_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("player_id", player.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/spieler/${token}`);
  revalidatePath(`/players/${player.id}`);
}

