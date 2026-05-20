"use server";

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { healthRisk } from "@/lib/coach-metrics";
import { ACTIVE_TEAM_COOKIE, requireActiveTeam, requireUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
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
  TeamRole,
  TrainingIntensity,
  TrainingPhaseType,
  WinnerPointContextType
} from "@/lib/types";

const phaseTypes: TrainingPhaseType[] = [
  "warmup",
  "technique",
  "tactics",
  "game_form",
  "finish",
  "cooldown"
];

const trainingPresets = {
  pressing: {
    focus: "Pressing nach Ballverlust",
    goal:
      "Das Team erkennt Umschaltmomente schneller und stellt sofort Druck auf Ball und nächste Passoptionen her.",
    intensity: "high" as TrainingIntensity,
    phases: [
      ["warmup", "Aktivierung mit Gegenpressing", 12, "Rondo mit sofortigem Umschalten nach Ballverlust."],
      ["technique", "Erster Druck und Deckungsschatten", 15, "Anlaufwinkel, Körperstellung und kurze Sprintwege wiederholen."],
      ["tactics", "Pressingfalle am Flügel", 20, "Team verschiebt geschlossen und lenkt den Gegner in die Falle."],
      ["game_form", "6v6+3 Umschaltspiel", 25, "Nach Ballverlust fünf Sekunden Vollpressing, danach neu ordnen."],
      ["finish", "Pressing-Wettkampf", 12, "Punkte für Ballgewinne in gefährlichen Zonen."],
      ["cooldown", "Review", 6, "Welche Trigger haben funktioniert? Spielerfeedback sammeln."]
    ]
  },
  buildup: {
    focus: "Spielaufbau gegen hohes Pressing",
    goal:
      "Das Team findet klare Auswege über Torhüter, Sechser und diagonale Anschlussaktionen.",
    intensity: "medium" as TrainingIntensity,
    phases: [
      ["warmup", "Passfenster öffnen", 12, "Positionsspiel mit offener Körperstellung und Scan vor dem ersten Kontakt."],
      ["technique", "Dritter-Mann-Kombinationen", 16, "Klare Passschärfe und Anschlusspositionen trainieren."],
      ["tactics", "Aufbau 7v5", 22, "Pressinglinien erkennen und mit Dreiecken überspielen."],
      ["game_form", "Halbfeldspiel mit Aufbauzone", 25, "Tore zählen doppelt nach kontrolliertem Aufbau."],
      ["finish", "Spielnaher Abschluss", 10, "Nach Durchbruch über Zentrum oder Flügel abschließen."],
      ["cooldown", "Prinzipien sichern", 5, "Drei Aufbauprinzipien für das nächste Spiel festhalten."]
    ]
  },
  finishing: {
    focus: "Abschluss unter Druck",
    goal:
      "Spieler treffen schneller Entscheidungen im letzten Drittel und kommen unter Gegnerdruck sauber zum Abschluss.",
    intensity: "medium" as TrainingIntensity,
    phases: [
      ["warmup", "Technische Aktivierung", 10, "Ballmitnahme, erster Kontakt und kurze Abschlüsse."],
      ["technique", "Abschlusswinkel", 18, "Flache und hohe Abschlüsse nach Zuspiel und Dribbling."],
      ["tactics", "Letzter Pass", 18, "Timing von Tiefenlauf, Rückraum und Querpass."],
      ["game_form", "4v4+Torhüter", 28, "Abschluss innerhalb von acht Sekunden nach Ballgewinn."],
      ["finish", "Druck-Challenge", 12, "Teamwettkampf mit wechselnden Abschlusszonen."],
      ["cooldown", "Kurzer Review", 4, "Beste Abschlussoptionen und Entscheidungsqualität besprechen."]
    ]
  }
} satisfies Record<
  string,
  {
    focus: string;
    goal: string;
    intensity: TrainingIntensity;
    phases: [TrainingPhaseType, string, number, string][];
  }
>;

function requiredString(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) {
    return null;
  }

  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function normalizeExternalUrl(rawUrl: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ||
    rawUrl.startsWith("/") ||
    rawUrl.includes(" ")
    ? rawUrl
    : `https://${rawUrl}`;
}

function requiredRating(formData: FormData) {
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new Error("Rating must be between 1 and 10.");
  }
  return rating;
}

function scaleFive(formData: FormData, key: string, label: string) {
  const value = Number(formData.get(key));
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be between 1 and 5.`);
  }
  return value;
}

function optionalScaleFive(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${key} must be between 1 and 5.`);
  }
  return value;
}

function redirectWithMessage(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function canManageWorkspace(role: TeamRole) {
  return role === "owner" || role === "head_coach";
}

function inviteCode() {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

function playerName(formData: FormData) {
  const firstName = requiredString(formData, "first_name", "First name");
  const lastName = requiredString(formData, "last_name", "Last name");
  return { firstName, lastName, name: `${firstName} ${lastName}`.trim() };
}

function splitPlayerImportLine(line: string) {
  return line
    .split(/\t|;|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function looksLikePlayerImportHeader(line: string) {
  const normalized = line.toLowerCase();
  return (
    normalized.includes("vorname") ||
    normalized.includes("first") ||
    normalized.includes("nachname") ||
    normalized.includes("last")
  );
}

function enumValue<T extends string>(
  formData: FormData,
  key: string,
  allowed: readonly T[]
) {
  const value = String(formData.get(key) ?? "").trim();
  return allowed.includes(value as T) ? (value as T) : null;
}

async function setActiveTeamCookie(teamId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

async function authRedirectUrl() {
  const origin = (await headers()).get("origin") ?? getSiteUrl();
  return `${origin}/auth/callback`;
}

export async function signIn(formData: FormData) {
  const email = requiredString(formData, "email", "Email");
  const password = requiredString(formData, "password", "Password");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirectWithMessage("/login", error.message);
  }

  redirect("/");
}

export async function signUp(formData: FormData) {
  const email = requiredString(formData, "email", "Email");
  const password = requiredString(formData, "password", "Password");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await authRedirectUrl()
    }
  });

  if (error) {
    redirectWithMessage("/login", error.message);
  }

  if (data.session) {
    redirect("/workspaces");
  }

  redirectWithMessage("/login", "Check your email to confirm the account.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setActiveTeam(formData: FormData) {
  const { supabase, user } = await requireUser();
  const teamId = requiredString(formData, "team_id", "Workspace");

  const { error } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await setActiveTeamCookie(teamId);
  revalidatePath("/");
  redirect("/");
}

export async function createTeam(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      name: requiredString(formData, "name", "Workspace name"),
      season: optionalString(formData, "season"),
      age_group: optionalString(formData, "age_group"),
      created_by: user.id
    })
    .select("id")
    .single();

  if (teamError) {
    throw new Error(teamError.message);
  }

  const { error: membershipError } = await supabase.from("team_members").insert({
    team_id: team.id,
    user_id: user.id,
    role: "owner"
  });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  await setActiveTeamCookie(team.id);
  revalidatePath("/");
  redirect("/");
}

export async function updateTeam(formData: FormData) {
  const { supabase, team, membership } = await requireActiveTeam();

  if (!canManageWorkspace(membership.role)) {
    throw new Error("Only lead coaches can update workspace settings.");
  }

  const { error } = await supabase
    .from("teams")
    .update({
      name: requiredString(formData, "name", "Workspace name"),
      season: optionalString(formData, "season"),
      age_group: optionalString(formData, "age_group")
    })
    .eq("id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/workspaces");
}

export async function createTeamInvite(formData: FormData) {
  const { supabase, user, team, membership } = await requireActiveTeam();

  if (!canManageWorkspace(membership.role)) {
    throw new Error("Only lead coaches can invite staff members.");
  }

  const role = enumValue(formData, "role", ["head_coach", "coach"] as const);
  if (!role) {
    throw new Error("Invite role is required.");
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const { error } = await supabase.from("team_invites").insert({
    team_id: team.id,
    code: inviteCode(),
    role,
    created_by: user.id,
    expires_at: expiresAt.toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/workspaces");
}

export async function joinTeamWithInvite(formData: FormData) {
  const { supabase } = await requireUser();
  const code = requiredString(formData, "code", "Invite code").toUpperCase();

  const { data: teamId, error } = await supabase.rpc("join_team_with_invite", {
    invite_code: code
  });

  if (error) {
    redirectWithMessage("/workspaces", error.message);
  }

  if (teamId) {
    await setActiveTeamCookie(teamId);
  }

  revalidatePath("/");
  redirect("/");
}

export async function createPlayer(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const { firstName, lastName, name } = playerName(formData);

  const { error } = await supabase.from("players").insert({
    team_id: team.id,
    user_id: user.id,
    name,
    first_name: firstName,
    last_name: lastName,
    position: optionalString(formData, "position"),
    team_category: optionalString(formData, "team_category") ?? team.age_group,
    birth_year: optionalNumber(formData, "birth_year"),
    jersey_number: optionalNumber(formData, "jersey_number")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function importPlayers(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const raw = requiredString(formData, "players_csv", "Player list");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => index !== 0 || !looksLikePlayerImportHeader(line));

  const rows = lines.flatMap((line) => {
    const columns = splitPlayerImportLine(line);
    if (columns.length === 0) {
      return [];
    }

    const [firstColumn, secondColumn, position, birthYear, jerseyNumber, teamCategory] =
      columns;
    const fallbackParts = firstColumn.split(/\s+/).filter(Boolean);
    const firstName = secondColumn ? firstColumn : fallbackParts[0];
    const lastName = secondColumn
      ? secondColumn
      : fallbackParts.slice(1).join(" ") || "-";
    const name = `${firstName} ${lastName}`.trim();
    const parsedBirthYear = birthYear ? Number(birthYear) : null;
    const parsedJerseyNumber = jerseyNumber ? Number(jerseyNumber) : null;

    return [
      {
        team_id: team.id,
        user_id: user.id,
        name,
        first_name: firstName,
        last_name: lastName,
        position: position || null,
        team_category: teamCategory || team.age_group,
        birth_year:
          parsedBirthYear !== null && Number.isFinite(parsedBirthYear)
            ? parsedBirthYear
            : null,
        jersey_number:
          parsedJerseyNumber !== null && Number.isFinite(parsedJerseyNumber)
            ? parsedJerseyNumber
            : null
      }
    ];
  });

  if (rows.length === 0) {
    throw new Error("No players found in import.");
  }

  const { error } = await supabase.from("players").insert(rows);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function updatePlayer(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Player");
  const { firstName, lastName, name } = playerName(formData);
  const strongFoot = enumValue(formData, "strong_foot", [
    "left",
    "right",
    "both"
  ] as const) as StrongFoot | null;
  const status = enumValue(formData, "status", [
    "available",
    "injured",
    "limited",
    "absent"
  ] as const) as PlayerStatus | null;

  const { error } = await supabase
    .from("players")
    .update({
      name,
      first_name: firstName,
      last_name: lastName,
      position: optionalString(formData, "position"),
      secondary_positions:
        optionalString(formData, "secondary_positions")
          ?.split(",")
          .map((item) => item.trim())
          .filter(Boolean) ?? null,
      birth_date: optionalString(formData, "birth_date"),
      birth_year: optionalNumber(formData, "birth_year"),
      team_category: optionalString(formData, "team_category"),
      jersey_number: optionalNumber(formData, "jersey_number"),
      photo_url: optionalString(formData, "photo_url"),
      strong_foot: strongFoot,
      height_cm: optionalNumber(formData, "height_cm"),
      weight_kg: optionalNumber(formData, "weight_kg"),
      contact: optionalString(formData, "contact"),
      parent_contact: optionalString(formData, "parent_contact"),
      emergency_contact: optionalString(formData, "emergency_contact"),
      player_account_email: optionalString(formData, "player_account_email")?.toLowerCase() ?? null,
      favorite_team: optionalString(formData, "favorite_team"),
      favorite_player: optionalString(formData, "favorite_player"),
      football_goals: optionalString(formData, "football_goals"),
      motivation: optionalString(formData, "motivation"),
      allergies: optionalString(formData, "allergies"),
      injuries: optionalString(formData, "injuries"),
      limitations: optionalString(formData, "limitations"),
      medications: optionalString(formData, "medications"),
      coach_alerts: optionalString(formData, "coach_alerts"),
      season_form_completed_at:
        formData.get("season_form_completed") === "on"
          ? new Date().toISOString()
          : null,
      medical_notes: optionalString(formData, "medical_notes"),
      strengths: optionalString(formData, "strengths"),
      weaknesses: optionalString(formData, "weaknesses"),
      development_goals: optionalString(formData, "development_goals"),
      training_notes: optionalString(formData, "training_notes"),
      personal_notes: optionalString(formData, "personal_notes"),
      notes: optionalString(formData, "notes"),
      status: status ?? "available",
      rating: optionalNumber(formData, "rating")
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  revalidatePath("/tactics");
}

export async function deletePlayer(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Player");

  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

const PLAYER_PHOTO_BUCKET = "player-photos";
const PLAYER_PHOTO_MAX_BYTES = 6 * 1024 * 1024;
const PLAYER_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  return url.slice(idx + marker.length).split("?")[0];
}

export async function uploadPlayerPhoto(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte wähle ein Bild aus.");
  }
  if (file.size > PLAYER_PHOTO_MAX_BYTES) {
    throw new Error("Bild ist zu groß (max 6 MB).");
  }
  if (file.type && !PLAYER_PHOTO_MIME_TYPES.has(file.type)) {
    throw new Error("Nur JPG, PNG, WEBP oder HEIC sind erlaubt.");
  }

  const { data: player, error: lookupError } = await supabase
    .from("players")
    .select("id,team_id,photo_url")
    .eq("id", playerId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }
  if (!player) {
    throw new Error("Spieler nicht gefunden.");
  }

  const extFromName = file.name.split(".").pop()?.toLowerCase();
  const extFromMime = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const ext =
    extFromName && /^[a-z0-9]+$/.test(extFromName) && extFromName.length <= 5
      ? extFromName
      : extFromMime;
  const path = `${team.id}/${playerId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${ext}`
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("players")
    .update({ photo_url: publicUrlData.publicUrl })
    .eq("id", playerId)
    .eq("team_id", team.id);

  if (updateError) {
    // Best effort cleanup of the uploaded blob if the row update fails.
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([path]);
    throw new Error(updateError.message);
  }

  // Best effort cleanup of the previous photo when it lived in our bucket.
  if (player.photo_url) {
    const oldPath = pathFromPublicUrl(player.photo_url, PLAYER_PHOTO_BUCKET);
    if (oldPath && oldPath !== path) {
      await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([oldPath]);
    }
  }

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/tactics");
  revalidatePath("/pitch");
}

export async function removePlayerPhoto(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const { data: player, error: lookupError } = await supabase
    .from("players")
    .select("id,team_id,photo_url")
    .eq("id", playerId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }
  if (!player) {
    throw new Error("Spieler nicht gefunden.");
  }
  if (!player.photo_url) {
    return;
  }

  const oldPath = pathFromPublicUrl(player.photo_url, PLAYER_PHOTO_BUCKET);
  if (oldPath) {
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([oldPath]);
  }

  const { error: updateError } = await supabase
    .from("players")
    .update({ photo_url: null })
    .eq("id", playerId)
    .eq("team_id", team.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/tactics");
  revalidatePath("/pitch");
}

const TRAINING_IMAGE_BUCKET = "training-images";
const TRAINING_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const TRAINING_IMAGE_MAX_PER_PHASE = 8;
const TRAINING_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif"
]);

export async function uploadPhaseImage(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Trainingsphase");
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte wähle ein Bild aus.");
  }
  if (file.size > TRAINING_IMAGE_MAX_BYTES) {
    throw new Error("Bild ist zu groß (max 8 MB).");
  }
  if (file.type && !TRAINING_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Nur JPG, PNG, WEBP, GIF oder HEIC sind erlaubt.");
  }

  const { data: phase, error: lookupError } = await supabase
    .from("training_phases")
    .select("id,team_id,training_id,image_urls")
    .eq("id", phaseId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }
  if (!phase) {
    throw new Error("Trainingsphase nicht gefunden.");
  }

  const currentImages = phase.image_urls ?? [];
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
  const path = `${team.id}/${phase.training_id}/${phaseId}-${Date.now()}.${ext}`;

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

  const { error: updateError } = await supabase
    .from("training_phases")
    .update({ image_urls: nextImages })
    .eq("id", phaseId)
    .eq("team_id", team.id);

  if (updateError) {
    // Best effort cleanup of the uploaded blob if the row update fails.
    await supabase.storage.from(TRAINING_IMAGE_BUCKET).remove([path]);
    throw new Error(updateError.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function removePhaseImage(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Trainingsphase");
  const imageUrl = requiredString(formData, "image_url", "Bild-URL");

  const { data: phase, error: lookupError } = await supabase
    .from("training_phases")
    .select("id,team_id,image_urls")
    .eq("id", phaseId)
    .eq("team_id", team.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }
  if (!phase) {
    throw new Error("Trainingsphase nicht gefunden.");
  }

  const currentImages = phase.image_urls ?? [];
  if (!currentImages.includes(imageUrl)) {
    return;
  }
  const nextImages = currentImages.filter((url) => url !== imageUrl);

  const { error: updateError } = await supabase
    .from("training_phases")
    .update({ image_urls: nextImages })
    .eq("id", phaseId)
    .eq("team_id", team.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Best effort: lösche den Storage-Blob, wenn er aus unserem Bucket stammt.
  // Bei duplizierten Trainings, die dieselbe URL referenzieren, wird der Link
  // ggf. ungültig — bewusst akzeptiertes Trade-off (siehe duplicateTraining).
  const path = pathFromPublicUrl(imageUrl, TRAINING_IMAGE_BUCKET);
  if (path) {
    await supabase.storage.from(TRAINING_IMAGE_BUCKET).remove([path]);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function submitPlayerSeasonForm(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "player_id", "Player");
  const strongFoot = enumValue(formData, "strong_foot", [
    "left",
    "right",
    "both"
  ] as const) as StrongFoot | null;

  const { error } = await supabase
    .from("players")
    .update({
      strong_foot: strongFoot,
      contact: optionalString(formData, "contact"),
      parent_contact: optionalString(formData, "parent_contact"),
      emergency_contact: optionalString(formData, "emergency_contact"),
      favorite_team: optionalString(formData, "favorite_team"),
      favorite_player: optionalString(formData, "favorite_player"),
      football_goals: optionalString(formData, "football_goals"),
      motivation: optionalString(formData, "motivation"),
      strengths: optionalString(formData, "strengths"),
      weaknesses: optionalString(formData, "weaknesses"),
      allergies: optionalString(formData, "allergies"),
      injuries: optionalString(formData, "injuries"),
      limitations: optionalString(formData, "limitations"),
      medications: optionalString(formData, "medications"),
      season_form_completed_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/player-mode");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
}

function trainingPayload(formData: FormData) {
  const intensity = enumValue(formData, "intensity", [
    "low",
    "medium",
    "high"
  ] as const) as TrainingIntensity | null;

  return {
    date: requiredString(formData, "date", "Training date"),
    start_time: optionalString(formData, "start_time"),
    duration_minutes: optionalNumber(formData, "duration_minutes"),
    location: optionalString(formData, "location"),
    focus: requiredString(formData, "focus", "Training focus"),
    goal: optionalString(formData, "goal"),
    age_group: optionalString(formData, "age_group"),
    intensity,
    participants: optionalString(formData, "participants"),
    notes: optionalString(formData, "notes"),
    is_template: formData.get("is_template") === "on",
    template_name: optionalString(formData, "template_name")
  };
}

function phaseRows(
  formData: FormData,
  teamId: string,
  trainingId: string,
  imagesByType?: Map<TrainingPhaseType, string[]>
) {
  return phaseTypes
    .map((phaseType, index) => {
      const title = optionalString(formData, `${phaseType}_title`);
      const description = optionalString(formData, `${phaseType}_description`);
      const duration = optionalNumber(formData, `${phaseType}_duration`);

      if (!title && !description && !duration) {
        return null;
      }

      return {
        team_id: teamId,
        training_id: trainingId,
        phase_type: phaseType,
        title: title ?? phaseType.replace("_", " "),
        duration_minutes: duration,
        description,
        coaching_points: optionalString(formData, `${phaseType}_coaching`),
        organization: optionalString(formData, `${phaseType}_organization`),
        material: optionalString(formData, `${phaseType}_material`),
        player_count: optionalString(formData, `${phaseType}_players`),
        field_size: optionalString(formData, `${phaseType}_field`),
        variations: optionalString(formData, `${phaseType}_variations`),
        load_management: optionalString(formData, `${phaseType}_load`),
        image_urls: imagesByType?.get(phaseType) ?? [],
        sort_order: index
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function createTraining(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();

  const { data: training, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: team.id,
      user_id: user.id,
      ...trainingPayload(formData)
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const rows = phaseRows(formData, team.id, training.id);
  if (rows.length > 0) {
    const { error: phaseError } = await supabase
      .from("training_phases")
      .insert(rows);

    if (phaseError) {
      throw new Error(phaseError.message);
    }
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function updateTraining(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Training");

  const { error } = await supabase
    .from("training_sessions")
    .update(trainingPayload(formData))
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  // Preserve uploaded phase images across the delete/insert cycle by snapshotting
  // them keyed by phase_type, then re-injecting on the new rows below.
  const { data: existingPhases, error: existingError } = await supabase
    .from("training_phases")
    .select("phase_type,image_urls")
    .eq("training_id", id)
    .eq("team_id", team.id);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const imagesByType = new Map<TrainingPhaseType, string[]>();
  for (const row of existingPhases ?? []) {
    if (row.image_urls && row.image_urls.length > 0) {
      imagesByType.set(row.phase_type as TrainingPhaseType, row.image_urls);
    }
  }

  const { error: deleteError } = await supabase
    .from("training_phases")
    .delete()
    .eq("training_id", id)
    .eq("team_id", team.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows = phaseRows(formData, team.id, id, imagesByType);
  if (rows.length > 0) {
    const { error: phaseError } = await supabase
      .from("training_phases")
      .insert(rows);

    if (phaseError) {
      throw new Error(phaseError.message);
    }
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function deleteTacticBoard(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Taktikboard");
  const { error } = await supabase
    .from("tactic_boards")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);
  if (error) throw new Error(error.message);
  revalidatePath("/tactics");
}

export async function deleteTrainingWeek(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const ids = formData.getAll("training_id") as string[];
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("training_sessions")
    .delete()
    .in("id", ids)
    .eq("team_id", team.id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trainings");
}

export async function updatePhaseDiagram(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Phase");
  const diagramJson = requiredString(formData, "diagram", "Diagramm");
  let diagram: unknown;
  try {
    diagram = JSON.parse(diagramJson);
  } catch {
    throw new Error("Ungültiges Diagramm-Format");
  }
  const { error } = await supabase
    .from("training_phases")
    .update({ diagram: diagram as Json })
    .eq("id", phaseId)
    .eq("team_id", team.id);
  if (error) throw new Error(error.message);
  revalidatePath("/trainings");
}

export async function updateTrainingPhase(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const phaseId = requiredString(formData, "phase_id", "Phase");

  const { error } = await supabase
    .from("training_phases")
    .update({
      title: optionalString(formData, "title") ?? undefined,
      duration_minutes: optionalNumber(formData, "duration_minutes"),
      description: optionalString(formData, "description"),
      coaching_points: optionalString(formData, "coaching_points"),
      organization: optionalString(formData, "organization"),
      material: optionalString(formData, "material"),
      player_count: optionalString(formData, "player_count"),
      field_size: optionalString(formData, "field_size"),
      variations: optionalString(formData, "variations"),
      load_management: optionalString(formData, "load_management"),
    })
    .eq("id", phaseId)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/trainings");
}

export async function duplicateTraining(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Training");

  const [trainingResult, phasesResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("*")
      .eq("id", id)
      .eq("team_id", team.id)
      .single(),
    supabase
      .from("training_phases")
      .select("*")
      .eq("training_id", id)
      .eq("team_id", team.id)
      .order("sort_order", { ascending: true })
  ]);

  if (trainingResult.error) {
    throw new Error(trainingResult.error.message);
  }

  if (phasesResult.error) {
    throw new Error(phasesResult.error.message);
  }

  const training = trainingResult.data;
  const { data: clone, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: team.id,
      user_id: user.id,
      date: training.date,
      start_time: training.start_time,
      duration_minutes: training.duration_minutes,
      location: training.location,
      focus: `${training.focus} copy`,
      goal: training.goal,
      age_group: training.age_group,
      intensity: training.intensity,
      participants: training.participants,
      notes: training.notes,
      is_template: false
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const phaseClones =
    phasesResult.data?.map((phase) => ({
      team_id: team.id,
      training_id: clone.id,
      phase_type: phase.phase_type,
      title: phase.title,
      duration_minutes: phase.duration_minutes,
      description: phase.description,
      coaching_points: phase.coaching_points,
      organization: phase.organization,
      material: phase.material,
      player_count: phase.player_count,
      field_size: phase.field_size,
      variations: phase.variations,
      load_management: phase.load_management,
      // Bilder werden referenziert (nicht neu hochgeladen) — die öffentlichen
      // URLs bleiben gültig. Lösche ein Bild im Original ⇒ es bleibt im Storage,
      // bis das Duplikat es ebenfalls entfernt.
      image_urls: phase.image_urls ?? [],
      sort_order: phase.sort_order
    })) ?? [];

  if (phaseClones.length > 0) {
    const { error: phaseError } = await supabase
      .from("training_phases")
      .insert(phaseClones);

    if (phaseError) {
      throw new Error(phaseError.message);
    }
  }

  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function deleteTraining(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Training");

  const { error } = await supabase
    .from("training_sessions")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function createAiTrainingDraft(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const focus = requiredString(formData, "focus", "Schwerpunkt");
  const duration = optionalNumber(formData, "duration_minutes") ?? 90;
  const ageGroup = optionalString(formData, "age_group") ?? team.age_group;
  const date = requiredString(formData, "date", "Datum");
  const additionalContext = optionalString(formData, "context") ?? "";

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert. Bitte in .env.local setzen.");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [playersResult, checkinsResult, recentTrainingsResult, nextMatchResult] = await Promise.all([
    supabase.from("players").select("id,name,status").eq("team_id", team.id).order("name"),
    supabase
      .from("health_checkins")
      .select("player_id,checkin_date,fatigue,sleep_quality,soreness,pain,stress,motivation,energy,injury_feeling,wellbeing")
      .eq("team_id", team.id)
      .gte("checkin_date", sevenDaysAgo)
      .order("checkin_date", { ascending: false }),
    supabase
      .from("training_sessions")
      .select("date,focus,intensity")
      .eq("team_id", team.id)
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(4),
    supabase
      .from("matches")
      .select("date,opponent,kickoff_time")
      .eq("team_id", team.id)
      .gte("date", date)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  const players = playersResult.data ?? [];
  const checkins = checkinsResult.data ?? [];
  const recentTrainings = recentTrainingsResult.data ?? [];
  const nextMatch = nextMatchResult.data;

  const latestByPlayer = new Map<string, (typeof checkins)[number]>();
  for (const c of checkins) {
    if (!latestByPlayer.has(c.player_id)) latestByPlayer.set(c.player_id, c);
  }

  const available = players.filter((p) => p.status === "available" || !p.status);
  const limited = players.filter((p) => p.status === "limited");
  const injured = players.filter((p) => p.status === "injured");

  const wellnessLines = players
    .map((player) => {
      const c = latestByPlayer.get(player.id);
      if (!c) return `- ${player.name}: Kein aktueller Check-in`;
      const risk = healthRisk(c);
      const label =
        risk === "red"
          ? "🔴 ROT – unbedingt schonen!"
          : risk === "yellow"
            ? "🟡 GELB – beobachten"
            : "✅ GUT";
      return `- ${player.name}: Müdigkeit ${c.fatigue}/5, Schmerzen ${c.pain}/5, Energie ${c.energy}/5, Stress ${c.stress}/5, Schlaf ${c.sleep_quality}/5 → ${label}`;
    })
    .join("\n");

  const recentLines =
    recentTrainings.length > 0
      ? recentTrainings.map((t) => `- ${t.date}: ${t.focus} (${t.intensity ?? "?"} Intensität)`).join("\n")
      : "- Noch keine Trainings erfasst";

  const daysToMatch = nextMatch
    ? Math.round((new Date(`${nextMatch.date}T00:00`).getTime() - new Date(`${date}T00:00`).getTime()) / 86400000)
    : null;
  const matchLine = nextMatch
    ? `${nextMatch.date} gegen ${nextMatch.opponent}${nextMatch.kickoff_time ? ` · Anpfiff ${nextMatch.kickoff_time.slice(0, 5)} Uhr` : ""} — ${daysToMatch} Tag(e) bis zum Spiel`
    : "Kein Spiel in den nächsten 14 Tagen geplant";

  const prompt = `Du bist ein professioneller Fußballtrainer-Assistent mit tiefer Expertise in modernem Fußball-Training, Trainingslehre und Belastungssteuerung.

Erstelle einen vollständigen, praxisorientierten Trainingsplan für folgendes Team.

## TEAM
Name: ${team.name}
Altersstufe: ${ageGroup ?? "nicht angegeben"}
Kader: ${players.length} Spieler (${available.length} fit, ${limited.length} eingeschränkt, ${injured.length} verletzt)
Trainingsdatum: ${date}
Geplante Dauer: ${duration} Minuten

## TRAINER-VORGABE
Schwerpunkt: "${focus}"${additionalContext ? `\nZusätzliche Anweisungen: "${additionalContext}"` : ""}

## WELLNESS-STATUS ALLER SPIELER (letzte 7 Tage)
${wellnessLines || "Keine Check-in-Daten vorhanden — Standardbelastung ansetzen"}

## LETZTE TRAININGS
${recentLines}

## NÄCHSTES SPIEL
${matchLine}

## AUFGABE
Erstelle einen detaillierten Trainingsplan als JSON-Objekt. Antworte AUSSCHLIESSLICH mit gültigem JSON — kein Markdown, kein Fließtext.

KOORDINATENSYSTEM für diagram:
- x=0 linke Auslinie, x=100 rechte Auslinie
- y=0 gegnerisches Tor (Angriffsziel), y=100 eigenes Tor
- Team A = angreifendes/pressendes Team (blau), Team B = verteidigende/aufbauendes Team (rot)
- Neutrale Spieler = Joker/Anspielstation (gelb)
- Alle x/y-Koordinaten zwischen 0 und 100

{
  "focus": "Präziser, eingängiger Trainingstitel (max 60 Zeichen)",
  "goal": "Konkretes, messbares Trainingsziel — WAS wird trainiert und WARUM heute (2-3 präzise Sätze)",
  "intensity": "low" | "medium" | "high",
  "notes": "Trainer-Notizen: Welche Spieler heute namentlich schonen? Welche Belastungsanpassungen? Worauf besonders achten? (3-5 Sätze, sehr konkret)",
  "phases": [
    {
      "phase_type": "warmup" | "activation" | "technique" | "tactics" | "game_form" | "finish" | "cooldown",
      "title": "Phasentitel (3-5 Wörter)",
      "duration_minutes": Zahl,
      "description": "Detaillierte Übungsbeschreibung: Aufbau, Ablauf, Spielerpositionierung (3-6 Sätze)",
      "coaching_points": "3-5 konkrete Coachingpunkte die der Trainer aktiv einfordert — eine Zeile je Punkt",
      "organization": "Feldgröße, Gruppenaufteilung, Wechselregeln",
      "material": "Konkretes Material z.B. '6 Bälle, 8 Hütchen, 4 Leibchen, 2 Kleintore'",
      "variations": "Leichtere Variante / Schwierigere Variante (je eine Zeile)",
      "load_management": "Wie absolvieren eingeschränkte Spieler diese Phase konkret?",
      "diagram": {
        "field": "half | full | third | box",
        "players": [
          { "id": "A1", "team": "A", "role": "ST", "label": "ST", "x": 50, "y": 25 },
          { "id": "B1", "team": "B", "role": "IV", "label": "IV", "x": 50, "y": 40 },
          { "id": "N1", "team": "neutral", "role": "Joker", "label": "J", "x": 15, "y": 50 }
        ],
        "movements": [
          { "from": "A1", "to_x": 60, "to_y": 15, "type": "run | pass | dribble | shot", "label": "Tiefenlauf", "sequence": 1 }
        ],
        "zones": [
          { "label": "Presszone", "x": 20, "y": 15, "w": 60, "h": 25, "color": "red | orange | blue | green" }
        ],
        "goals": [
          { "type": "big_goal | mini_goal", "label": "Tor", "x": 50, "y": 0, "width": 15 }
        ]
      }
    }
  ]
}

QUALITÄTSREGELN:
- 4-6 Phasen die zusammen exakt ${duration} Minuten ergeben
- Intensität: Viele 🔴/🟡 Spieler → "low", gemischtes Team → "medium", frisches Team → "high"
- Coachingpunkte sind KONKRET (nicht 'Kommunikation' sondern 'Spieler ruft den Namen vor dem Pass')
- 🔴-Spieler werden namentlich in notes UND load_management erwähnt
- Übungen sind altersgruppengerecht für ${ageGroup ?? "die Altersgruppe"}
- Das Trainingsziel passt exakt zum Schwerpunkt
- DIAGRAM-REGELN: Spieler nie alle auf einer Linie. Koordinaten taktisch sinnvoll. Warmup/Cooldown: Kreis- oder Reihenformation. Taktik/Spielform: realistische Abstände, erkennbare Struktur. movements.from muss eine existierende player id sein. Alle x/y zwischen 0 und 100.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  type AiPhase = {
    phase_type: string;
    title: string;
    duration_minutes: number;
    description: string;
    coaching_points: string;
    organization: string;
    material: string;
    variations: string;
    load_management: string;
    diagram?: object | null;
  };
  type AiPlan = {
    focus: string;
    goal: string;
    intensity: string;
    notes: string;
    phases: AiPhase[];
  };

  let plan: AiPlan;
  try {
    plan = JSON.parse(jsonText);
  } catch {
    throw new Error("Die KI hat ein ungültiges Format zurückgegeben. Bitte erneut versuchen.");
  }

  const validIntensities: TrainingIntensity[] = ["low", "medium", "high"];
  const intensity: TrainingIntensity = validIntensities.includes(plan.intensity as TrainingIntensity)
    ? (plan.intensity as TrainingIntensity)
    : "medium";

  const { data: training, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: team.id,
      user_id: user.id,
      date,
      duration_minutes: duration,
      focus: plan.focus || focus,
      goal: plan.goal,
      age_group: ageGroup,
      intensity,
      notes: plan.notes,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const phaseRows = (plan.phases ?? []).map((phase, index) => ({
    team_id: team.id,
    training_id: training.id,
    phase_type: (phase.phase_type ?? "technique") as TrainingPhaseType,
    title: phase.title ?? "",
    duration_minutes: phase.duration_minutes ?? null,
    description: phase.description ?? null,
    coaching_points: phase.coaching_points ?? null,
    organization: phase.organization ?? null,
    material: phase.material ?? null,
    variations: phase.variations ?? null,
    load_management: phase.load_management ?? null,
    diagram: (phase.diagram ?? null) as import("@/lib/types").Json | null,
    sort_order: index,
  }));

  const { error: phaseError } = await supabase.from("training_phases").insert(phaseRows);
  if (phaseError) throw new Error(phaseError.message);

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function createPresetTraining(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const presetKey = requiredString(formData, "preset", "Preset");
  const preset = trainingPresets[presetKey as keyof typeof trainingPresets];

  if (!preset) {
    throw new Error("Unknown training preset.");
  }

  const date = requiredString(formData, "date", "Training date");
  const duration = optionalNumber(formData, "duration_minutes") ?? 90;
  const phaseTotal = preset.phases.reduce((sum, phase) => sum + phase[2], 0);

  const { data: training, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: team.id,
      user_id: user.id,
      date,
      start_time: optionalString(formData, "start_time"),
      duration_minutes: duration,
      location: optionalString(formData, "location"),
      focus: preset.focus,
      goal: preset.goal,
      age_group: team.age_group,
      intensity: preset.intensity,
      notes:
        "Vorlage aus der CoachOS-Bibliothek. Passe Phasen, Belastung und Coachingpunkte an dein Team an."
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const rows = preset.phases.map(([phaseType, title, minutes, description], index) => ({
    team_id: team.id,
    training_id: training.id,
    phase_type: phaseType,
    title,
    duration_minutes: Math.max(5, Math.round((minutes / phaseTotal) * duration)),
    description,
    coaching_points:
      "Timing, Abstände, Kommunikation und Entscheidungsqualität aktiv coachen.",
    organization:
      "Feldgröße und Spielerzahl an Kadergröße anpassen; klare Wechsel- und Pausenregeln setzen.",
    material: "Bälle, Hütchen, Markierungsteller, Leibchen, Tore",
    player_count: "12-18",
    field_size: "Variabel",
    variations:
      "Leichter: mehr Raum und freie Kontakte. Schwerer: Kontaktlimit, Zeitdruck oder kleinere Zonen.",
    load_management:
      preset.intensity === "high"
        ? "Kurze intensive Blöcke mit klaren Pausen."
        : "Mittlere Belastung mit fließenden Übergängen.",
    sort_order: index
  }));

  const { error: phaseError } = await supabase.from("training_phases").insert(rows);
  if (phaseError) {
    throw new Error(phaseError.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

export async function saveAttendance(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const trainingId = requiredString(formData, "training_id", "Training");
  const playerIds = formData.getAll("player_id").map(String);
  const presentIds = new Set(formData.getAll("present_player_id").map(String));

  const { data: players, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", team.id)
    .in("id", playerIds);

  if (playerError) {
    throw new Error(playerError.message);
  }

  const rows =
    players?.map((player) => {
      const status: AttendanceStatus = presentIds.has(player.id)
        ? "present"
        : "absent";

      return {
        team_id: team.id,
        user_id: user.id,
        training_id: trainingId,
        player_id: player.id,
        status
      };
    }) ?? [];

  if (rows.length > 0) {
    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "training_id,player_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/");
  revalidatePath("/pitch");
  revalidatePath("/trainings");
}

function matchPayload(formData: FormData) {
  return {
    opponent: requiredString(formData, "opponent", "Opponent"),
    date: requiredString(formData, "date", "Match date"),
    competition: optionalString(formData, "competition"),
    team_category: optionalString(formData, "team_category"),
    kickoff_time: optionalString(formData, "kickoff_time"),
    location: optionalString(formData, "location"),
    home_away: enumValue(formData, "home_away", [
      "home",
      "away",
      "neutral"
    ] as const) as HomeAway | null,
    meeting_point: optionalString(formData, "meeting_point"),
    squad_notes: optionalString(formData, "squad_notes"),
    starting_lineup: optionalString(formData, "starting_lineup"),
    substitutes: optionalString(formData, "substitutes"),
    formation: optionalString(formData, "formation"),
    tactical_instructions: optionalString(formData, "tactical_instructions"),
    match_goals: optionalString(formData, "match_goals"),
    pre_match_notes: optionalString(formData, "pre_match_notes"),
    halftime_notes: optionalString(formData, "halftime_notes"),
    post_match_notes: optionalString(formData, "post_match_notes"),
    result: optionalString(formData, "result"),
    scorers: optionalString(formData, "scorers"),
    assists: optionalString(formData, "assists"),
    cards: optionalString(formData, "cards"),
    conclusion: optionalString(formData, "conclusion"),
    notes: optionalString(formData, "notes")
  };
}

export async function createMatch(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const payload = matchPayload(formData);

  const { error } = await supabase.from("matches").insert({
    team_id: team.id,
    user_id: user.id,
    ...payload,
    team_category: payload.team_category ?? team.age_group
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

export async function updateMatch(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Match");

  const { error } = await supabase
    .from("matches")
    .update(matchPayload(formData))
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

export async function deleteMatch(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Match");

  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

async function buildMaterialContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
  type: MaterialType,
  customContent: string | null
) {
  if (customContent) {
    return customContent;
  }

  if (type === "player_list" || type === "attendance_list") {
    const { data: players, error } = await supabase
      .from("players")
      .select("name,position,birth_year,jersey_number,status")
      .eq("team_id", teamId)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    if (!players || players.length === 0) {
      return "Noch keine Spieler im Workspace.";
    }

    if (type === "attendance_list") {
      return [
        "Anwesenheitsliste",
        "",
        ...players.map(
          (player, index) =>
            `[ ] ${index + 1}. ${player.name} | ${player.position ?? "-"} | #${player.jersey_number ?? "-"}`
        )
      ].join("\n");
    }

    return [
      "Spielerliste",
      "",
      "Nr. | Name | Position | Jahrgang | Status",
      "--- | --- | --- | --- | ---",
      ...players.map(
        (player) =>
          `${player.jersey_number ?? "-"} | ${player.name} | ${player.position ?? "-"} | ${player.birth_year ?? "-"} | ${player.status}`
      )
    ].join("\n");
  }

  if (type === "training_plan") {
    const { data: training, error } = await supabase
      .from("training_sessions")
      .select("id,date,start_time,duration_minutes,focus,goal,location,intensity")
      .eq("team_id", teamId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

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

    const { data: phases, error: phaseError } = await supabase
      .from("training_phases")
      .select("phase_type,title,duration_minutes,description,coaching_points,material")
      .eq("team_id", teamId)
      .eq("training_id", training.id)
      .order("sort_order", { ascending: true });

    if (phaseError) {
      throw new Error(phaseError.message);
    }

    return [
      `Trainingsplan: ${training.focus}`,
      `Datum: ${training.date}${training.start_time ? ` ${training.start_time.slice(0, 5)}` : ""}`,
      `Ort: ${training.location ?? "-"}`,
      `Dauer: ${training.duration_minutes ?? "-"} Minuten`,
      `Intensität: ${training.intensity ?? "-"}`,
      "",
      `Ziel: ${training.goal ?? "-"}`,
      "",
      ...(phases ?? []).map(
        (phase) =>
          `${phase.title} (${phase.duration_minutes ?? "-"} Min)\n${phase.description ?? ""}\nCoaching: ${phase.coaching_points ?? "-"}\nMaterial: ${phase.material ?? "-"}\n`
      )
    ].join("\n");
  }

  if (type === "match_plan") {
    const today = new Date().toISOString().slice(0, 10);
    const { data: match, error } = await supabase
      .from("matches")
      .select("opponent,date,kickoff_time,location,meeting_point,formation,starting_lineup,substitutes,tactical_instructions,match_goals")
      .eq("team_id", teamId)
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return match
      ? [
          `Matchplan: ${match.opponent}`,
          `Datum: ${match.date}${match.kickoff_time ? ` ${match.kickoff_time.slice(0, 5)}` : ""}`,
          `Ort: ${match.location ?? "-"}`,
          `Treffpunkt: ${match.meeting_point ?? "-"}`,
          `Formation: ${match.formation ?? "-"}`,
          "",
          "Startelf:",
          match.starting_lineup ?? "-",
          "",
          "Ersatzspieler:",
          match.substitutes ?? "-",
          "",
          "Taktik:",
          match.tactical_instructions ?? "-",
          "",
          "Matchziele:",
          match.match_goals ?? "-"
        ].join("\n")
      : "Matchplan\n\nGegner:\nDatum:\nTreffpunkt:\nFormation:\nStartelf:\nTaktik:\nMatchziele:";
  }

  if (type === "week_plan" || type === "month_plan") {
    const [trainingsResult, matchesResult] = await Promise.all([
      supabase
        .from("training_sessions")
        .select("date,start_time,focus,location")
        .eq("team_id", teamId)
        .order("date", { ascending: true })
        .limit(type === "week_plan" ? 10 : 40),
      supabase
        .from("matches")
        .select("date,kickoff_time,opponent,location")
        .eq("team_id", teamId)
        .order("date", { ascending: true })
        .limit(type === "week_plan" ? 10 : 40)
    ]);

    if (trainingsResult.error) {
      throw new Error(trainingsResult.error.message);
    }

    if (matchesResult.error) {
      throw new Error(matchesResult.error.message);
    }

    const events = [
      ...(trainingsResult.data ?? []).map(
        (event) =>
          `${event.date} ${event.start_time?.slice(0, 5) ?? ""} | Training | ${event.focus} | ${event.location ?? "-"}`
      ),
      ...(matchesResult.data ?? []).map(
        (event) =>
          `${event.date} ${event.kickoff_time?.slice(0, 5) ?? ""} | Spiel | ${event.opponent} | ${event.location ?? "-"}`
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
      "Pressingauslöser:",
      "Aufbau:",
      "Umschalten:",
      "Standards:"
    ].join("\n");
  }

  return [
    "Übungsblatt",
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
  const { supabase, user, team } = await requireActiveTeam();
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
    supabase,
    team.id,
    type,
    optionalString(formData, "content")
  );

  const { error } = await supabase.from("materials").insert({
    team_id: team.id,
    user_id: user.id,
    type,
    title: requiredString(formData, "title", "Title"),
    description: optionalString(formData, "description"),
    content
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/materials");
}

export async function updateMaterial(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Material");

  const { error } = await supabase
    .from("materials")
    .update({
      title: requiredString(formData, "title", "Title"),
      description: optionalString(formData, "description"),
      content: optionalString(formData, "content")
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/materials");
}

export async function deleteMaterial(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Material");

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/materials");
}

type TacticRosterPlayer = {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
};

const tacticRosterPositions = [
  { x: 12, y: 50 },
  { x: 28, y: 22 },
  { x: 28, y: 40 },
  { x: 28, y: 60 },
  { x: 28, y: 78 },
  { x: 50, y: 32 },
  { x: 50, y: 50 },
  { x: 50, y: 68 },
  { x: 72, y: 26 },
  { x: 80, y: 50 },
  { x: 72, y: 74 }
] as const;

function tacticRosterPosition(index: number) {
  if (index < tacticRosterPositions.length) {
    return tacticRosterPositions[index];
  }

  const benchIndex = index - tacticRosterPositions.length;
  return {
    x: 12 + (benchIndex % 9) * 9.5,
    y: 88 - Math.floor(benchIndex / 9) * 7
  };
}

function tacticInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.at(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function tacticRosterElements(players: TacticRosterPlayer[]) {
  return players.map((player, index) => {
    const position = tacticRosterPosition(index);
    return {
      id: `player-${player.id}`,
      type: "player",
      label:
        player.jersey_number !== null
          ? String(player.jersey_number)
          : tacticInitials(player.name) || String(index + 1),
      name: player.name,
      playerId: player.id,
      position: player.position,
      x: position.x,
      y: position.y
    };
  });
}

export async function createTacticBoard(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id,name,position,jersey_number")
    .eq("team_id", team.id)
    .order("jersey_number", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (playersError) {
    throw new Error(playersError.message);
  }

  const { error } = await supabase.from("tactic_boards").insert({
    team_id: team.id,
    user_id: user.id,
    title: requiredString(formData, "title", "Board title"),
    description: optionalString(formData, "description"),
    elements: {
      version: 2,
      scenes: [
        {
          id: "scene-1",
          name: "Grundformation",
          elements: [
            ...tacticRosterElements(players ?? []),
            { id: "ball", type: "ball", label: "", x: 53, y: 58 }
          ]
        }
      ]
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tactics");
}

export async function saveTacticBoard(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Tactic board");
  const elementsRaw = requiredString(formData, "elements", "Board elements");

  let elements: unknown;
  try {
    elements = JSON.parse(elementsRaw);
  } catch {
    throw new Error("Board elements are invalid.");
  }

  const { error } = await supabase
    .from("tactic_boards")
    .update({
      title: requiredString(formData, "title", "Board title"),
      description: optionalString(formData, "description"),
      elements: elements as Json
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tactics");
}

export async function createTask(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();

  const { error } = await supabase.from("tasks").insert({
    team_id: team.id,
    user_id: user.id,
    title: requiredString(formData, "title", "Task"),
    due_date: optionalString(formData, "due_date"),
    related_type: optionalString(formData, "related_type")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/pitch");
}

export async function toggleTask(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Task");
  const status = enumValue(formData, "status", ["open", "done"] as const);

  const { error } = await supabase
    .from("tasks")
    .update({ status: status === "done" ? "open" : "done" })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/pitch");
}

export async function addFeedback(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const { error } = await supabase.from("player_feedback").insert({
    team_id: team.id,
    user_id: user.id,
    player_id: playerId,
    rating: requiredRating(formData),
    notes: optionalString(formData, "notes")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
}

export async function addWinnerPoints(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "other",
    "monday_training"
  ] as const) as WinnerPointContextType | null;
  const points = optionalNumber(formData, "points");

  if (!contextType) {
    throw new Error("Context type is required.");
  }

  if (!points || points < 1 || points > 50) {
    throw new Error("Winnerpunkte must be between 1 and 50.");
  }

  const { error } = await supabase.from("winner_points").insert({
    team_id: team.id,
    user_id: user.id,
    player_id: playerId,
    context_type: contextType,
    context_id: optionalString(formData, "context_id"),
    context_label: optionalString(formData, "context_label"),
    points,
    reason: optionalString(formData, "reason"),
    awarded_at: optionalString(formData, "awarded_at") ?? new Date().toISOString().slice(0, 10)
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/winnerpunkte");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updateWinnerPoints(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Winnerpunkte");
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "other",
    "monday_training"
  ] as const) as WinnerPointContextType | null;
  const points = optionalNumber(formData, "points");

  if (!contextType) {
    throw new Error("Context type is required.");
  }

  if (!points || points < 1 || points > 50) {
    throw new Error("Winnerpunkte must be between 1 and 50.");
  }

  const { error } = await supabase
    .from("winner_points")
    .update({
      player_id: playerId,
      context_type: contextType,
      context_id: optionalString(formData, "context_id"),
      context_label: optionalString(formData, "context_label"),
      points,
      reason: optionalString(formData, "reason"),
      awarded_at:
        optionalString(formData, "awarded_at") ??
        new Date().toISOString().slice(0, 10)
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/winnerpunkte");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deleteWinnerPoints(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Winnerpunkte");
  const playerId = optionalString(formData, "player_id");

  const { error } = await supabase
    .from("winner_points")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/winnerpunkte");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function createExternalLink(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const linkType = enumValue(formData, "link_type", [
    "clubcorner",
    "player_stats",
    "quali_document",
    "meeting_notes",
    "medical",
    "other"
  ] as const) as ExternalLinkType | null;
  const rawUrl = requiredString(formData, "url", "URL");

  if (!linkType) {
    throw new Error("Link type is required.");
  }

  const url = normalizeExternalUrl(rawUrl);
  const playerId = optionalString(formData, "player_id");

  const { error } = await supabase.from("external_links").insert({
    team_id: team.id,
    user_id: user.id,
    player_id: playerId,
    link_type: linkType,
    title: requiredString(formData, "title", "Title"),
    url,
    notes: optionalString(formData, "notes")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function updateExternalLink(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Link");
  const linkType = enumValue(formData, "link_type", [
    "clubcorner",
    "player_stats",
    "quali_document",
    "meeting_notes",
    "medical",
    "other"
  ] as const) as ExternalLinkType | null;
  const playerId = optionalString(formData, "player_id");

  if (!linkType) {
    throw new Error("Link type is required.");
  }

  const { error } = await supabase
    .from("external_links")
    .update({
      player_id: playerId,
      link_type: linkType,
      title: requiredString(formData, "title", "Title"),
      url: normalizeExternalUrl(requiredString(formData, "url", "URL")),
      notes: optionalString(formData, "notes")
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function deleteExternalLink(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Link");
  const playerId = optionalString(formData, "player_id");

  const { error } = await supabase
    .from("external_links")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function savePlayerEvaluation(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "monday_training"
  ] as const) as EvaluationContextType | null;

  if (!contextType) {
    throw new Error("Evaluation context is required.");
  }

  const row = {
    team_id: team.id,
    user_id: user.id,
    player_id: playerId,
    context_type: contextType,
    context_id: optionalString(formData, "context_id"),
    context_label: optionalString(formData, "context_label"),
    evaluation_date: optionalString(formData, "evaluation_date") ?? new Date().toISOString().slice(0, 10),
    participation: optionalScaleFive(formData, "participation"),
    motivation: optionalScaleFive(formData, "motivation"),
    training_quality: optionalScaleFive(formData, "training_quality"),
    match_quality: optionalScaleFive(formData, "match_quality"),
    behavior: optionalScaleFive(formData, "behavior"),
    effort: optionalScaleFive(formData, "effort"),
    concentration: optionalScaleFive(formData, "concentration"),
    notes: optionalString(formData, "notes")
  };

  const hasScore = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].some((value) => value !== null);

  if (!hasScore) {
    throw new Error("At least one score is required.");
  }

  const { error } = await supabase.from("player_evaluations").insert(row);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updatePlayerEvaluation(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Evaluation");
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "event",
    "monday_training"
  ] as const) as EvaluationContextType | null;

  if (!contextType) {
    throw new Error("Evaluation context is required.");
  }

  const row = {
    player_id: playerId,
    context_type: contextType,
    context_id: optionalString(formData, "context_id"),
    context_label: optionalString(formData, "context_label"),
    evaluation_date:
      optionalString(formData, "evaluation_date") ??
      new Date().toISOString().slice(0, 10),
    participation: optionalScaleFive(formData, "participation"),
    motivation: optionalScaleFive(formData, "motivation"),
    training_quality: optionalScaleFive(formData, "training_quality"),
    match_quality: optionalScaleFive(formData, "match_quality"),
    behavior: optionalScaleFive(formData, "behavior"),
    effort: optionalScaleFive(formData, "effort"),
    concentration: optionalScaleFive(formData, "concentration"),
    notes: optionalString(formData, "notes")
  };

  const hasScore = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].some((value) => value !== null);

  if (!hasScore) {
    throw new Error("At least one score is required.");
  }

  const { error } = await supabase
    .from("player_evaluations")
    .update(row)
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deletePlayerEvaluation(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Evaluation");
  const playerId = optionalString(formData, "player_id");

  const { error } = await supabase
    .from("player_evaluations")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function saveHealthCheckin(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "free"
  ] as const) as HealthContextType | null;

  const row = {
    team_id: team.id,
    user_id: user.id,
    player_id: playerId,
    checkin_date: optionalString(formData, "checkin_date") ?? new Date().toISOString().slice(0, 10),
    context_type: contextType ?? "training",
    fatigue: scaleFive(formData, "fatigue", "Fatigue"),
    sleep_quality: scaleFive(formData, "sleep_quality", "Sleep quality"),
    soreness: scaleFive(formData, "soreness", "Soreness"),
    pain: scaleFive(formData, "pain", "Pain"),
    stress: scaleFive(formData, "stress", "Stress"),
    motivation: scaleFive(formData, "motivation", "Motivation"),
    energy: scaleFive(formData, "energy", "Energy"),
    injury_feeling: scaleFive(formData, "injury_feeling", "Injury feeling"),
    wellbeing: scaleFive(formData, "wellbeing", "Wellbeing"),
    notes: optionalString(formData, "notes")
  };

  const { error } = await supabase
    .from("health_checkins")
    .upsert(row, { onConflict: "player_id,checkin_date,context_type" });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updateHealthCheckin(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Health check-in");
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "free"
  ] as const) as HealthContextType | null;

  const { error } = await supabase
    .from("health_checkins")
    .update({
      player_id: playerId,
      checkin_date:
        optionalString(formData, "checkin_date") ??
        new Date().toISOString().slice(0, 10),
      context_type: contextType ?? "training",
      fatigue: scaleFive(formData, "fatigue", "Fatigue"),
      sleep_quality: scaleFive(formData, "sleep_quality", "Sleep quality"),
      soreness: scaleFive(formData, "soreness", "Soreness"),
      pain: scaleFive(formData, "pain", "Pain"),
      stress: scaleFive(formData, "stress", "Stress"),
      motivation: scaleFive(formData, "motivation", "Motivation"),
      energy: scaleFive(formData, "energy", "Energy"),
      injury_feeling: scaleFive(formData, "injury_feeling", "Injury feeling"),
      wellbeing: scaleFive(formData, "wellbeing", "Wellbeing"),
      notes: optionalString(formData, "notes")
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deleteHealthCheckin(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Health check-in");
  const playerId = optionalString(formData, "player_id");

  const { error } = await supabase
    .from("health_checkins")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function createCoachMessage(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const body = requiredString(formData, "body", "Body");
  const title = optionalString(formData, "title");
  const category = (enumValue(formData, "category", [
    "training_goal",
    "match_goal",
    "note",
    "praise"
  ] as const) ?? "note") as CoachMessageCategory;

  const { error } = await supabase.from("coach_messages").insert({
    team_id: team.id,
    player_id: playerId,
    created_by: user.id,
    category,
    title,
    body
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/");
}

export async function deleteCoachMessage(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Message");
  const playerId = optionalString(formData, "player_id");

  const { error } = await supabase
    .from("coach_messages")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
  revalidatePath("/");
}

export async function saveMatchAnalysis(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const matchId = requiredString(formData, "match_id", "Match");

  const { error } = await supabase.from("match_analyses").upsert(
    {
      team_id: team.id,
      user_id: user.id,
      match_id: matchId,
      opponent_analysis: optionalString(formData, "opponent_analysis"),
      match_preparation: optionalString(formData, "match_preparation"),
      match_targets: optionalString(formData, "match_targets"),
      lineup_notes: optionalString(formData, "lineup_notes"),
      went_well: optionalString(formData, "went_well"),
      needs_work: optionalString(formData, "needs_work"),
      key_moments: optionalString(formData, "key_moments"),
      individual_performances: optionalString(formData, "individual_performances"),
      team_performance: optionalString(formData, "team_performance"),
      tactical_lessons: optionalString(formData, "tactical_lessons"),
      next_training_focus: optionalString(formData, "next_training_focus")
    },
    { onConflict: "match_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/analysis");
  revalidatePath("/matches");
}

function splitImportLine(line: string) {
  return line.split(/\t|;|,/).map((item) => item.trim());
}

function looksLikeMatchImportHeader(line: string) {
  const normalized = line.toLowerCase();
  return (
    normalized.includes("gegner") ||
    normalized.includes("opponent") ||
    normalized.includes("datum") ||
    normalized.includes("date")
  );
}

export async function importMatches(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const uploaded = formData.get("matches_file");
  let raw = optionalString(formData, "matches_csv") ?? "";

  if (
    typeof File !== "undefined" &&
    uploaded instanceof File &&
    uploaded.size > 0
  ) {
    raw = await uploaded.text();
  }

  if (!raw.trim()) {
    throw new Error("No match data found.");
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => index !== 0 || !looksLikeMatchImportHeader(line));

  const rows = lines.flatMap((line) => {
    const [date, opponent, kickoffTime, location, homeAway, competition, result, category] =
      splitImportLine(line);

    if (!date || !opponent) {
      return [];
    }

    return [
      {
        team_id: team.id,
        user_id: user.id,
        date,
        opponent,
        kickoff_time: kickoffTime || null,
        location: location || null,
        home_away: (["home", "away", "neutral"].includes(homeAway)
          ? homeAway
          : null) as HomeAway | null,
        competition: competition || null,
        result: result || null,
        team_category: category || team.age_group,
        upload_source: "manual_import"
      }
    ];
  });

  if (rows.length === 0) {
    throw new Error("No valid matches found in import.");
  }

  const { error } = await supabase.from("matches").insert(rows);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/analysis");
}

export async function createMondayTraining(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();

  const { error } = await supabase.from("monday_trainings").insert({
    team_id: team.id,
    user_id: user.id,
    date: requiredString(formData, "date", "Date"),
    topic: requiredString(formData, "topic", "Topic"),
    goal: optionalString(formData, "goal"),
    duration_minutes: optionalNumber(formData, "duration_minutes"),
    staff_notes: optionalString(formData, "staff_notes"),
    sandu_notes: optionalString(formData, "sandu_notes")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/monday");
}

export async function updateMondayTraining(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Monday training");

  const { error } = await supabase
    .from("monday_trainings")
    .update({
      date: requiredString(formData, "date", "Date"),
      topic: requiredString(formData, "topic", "Topic"),
      goal: optionalString(formData, "goal"),
      duration_minutes: optionalNumber(formData, "duration_minutes"),
      staff_notes: optionalString(formData, "staff_notes"),
      sandu_notes: optionalString(formData, "sandu_notes")
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/monday");
}

export async function deleteMondayTraining(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Monday training");

  const { error } = await supabase
    .from("monday_trainings")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/monday");
}

export async function saveMondayAttendance(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const mondayTrainingId = requiredString(formData, "monday_training_id", "Monday training");
  const playerIds = formData.getAll("player_id").map(String);
  const presentIds = new Set(formData.getAll("present_player_id").map(String));
  const injuredIds = new Set(formData.getAll("injured_player_id").map(String));

  const rows = playerIds.map((playerId) => {
    const status: MondayAttendanceStatus = injuredIds.has(playerId)
      ? "injured"
      : presentIds.has(playerId)
        ? "present"
        : "absent";

    return {
      team_id: team.id,
      user_id: user.id,
      monday_training_id: mondayTrainingId,
      player_id: playerId,
      status,
      note: optionalString(formData, `note_${playerId}`)
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("monday_attendance")
      .upsert(rows, { onConflict: "monday_training_id,player_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/monday");
}

export async function createPlayerAward(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const { data: latest, error: latestError } = await supabase
    .from("player_awards")
    .select("player_id")
    .eq("team_id", team.id)
    .order("award_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(latestError.message);
  }

  const { error } = await supabase.from("player_awards").insert({
    team_id: team.id,
    user_id: user.id,
    player_id: playerId,
    previous_player_id: optionalString(formData, "previous_player_id") ?? latest?.player_id ?? null,
    match_id: optionalString(formData, "match_id"),
    event_label: optionalString(formData, "event_label"),
    award_date: optionalString(formData, "award_date") ?? new Date().toISOString().slice(0, 10),
    reason: optionalString(formData, "reason")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/awards");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updatePlayerAward(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Award");
  const playerId = requiredString(formData, "player_id", "Player");

  const { error } = await supabase
    .from("player_awards")
    .update({
      player_id: playerId,
      previous_player_id: optionalString(formData, "previous_player_id"),
      match_id: optionalString(formData, "match_id"),
      event_label: optionalString(formData, "event_label"),
      award_date:
        optionalString(formData, "award_date") ??
        new Date().toISOString().slice(0, 10),
      reason: optionalString(formData, "reason")
    })
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/awards");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deletePlayerAward(formData: FormData) {
  const { supabase, team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Award");
  const playerId = optionalString(formData, "player_id");

  const { error } = await supabase
    .from("player_awards")
    .delete()
    .eq("id", id)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/awards");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}
