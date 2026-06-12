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
  TeamRole,
  TrainingIntensity,
  TrainingPhaseType,
  WinnerPointContextType
} from "@/lib/types";
import type { Role } from "@prisma/client";

const phaseTypes: TrainingPhaseType[] = [
  "warmup",
  "activation",
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

// SIGN IN & AUTHENTICATION ACTIONS
export async function signIn(formData: FormData) {
  const email = requiredString(formData, "email", "Email");
  const password = requiredString(formData, "password", "Password");

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: "/"
    });
  } catch (error: any) {
    if (error.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    redirectWithMessage("/login", "Ungültige E-Mail-Adresse oder Passwort.");
  }
}

export async function signUp(formData: FormData) {
  const email = requiredString(formData, "email", "Email").toLowerCase();
  const password = requiredString(formData, "password", "Password");

  if (password.length < 10) {
    redirectWithMessage("/login", "Das Passwort muss mindestens 10 Zeichen lang sein.");
  }

  try {
    const existingUser = await db.user.findUnique({ where: { email } });

    if (existingUser) {
      redirectWithMessage("/login", "Ein Benutzer mit dieser E-Mail existiert bereits.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.user.create({
      data: { email, passwordHash, role: "TRAINER" },
    });

    redirectWithMessage("/login", "Registrierung erfolgreich. Bitte melde dich an.");
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("[signUp] error:", err?.code, err?.message, err);
    redirectWithMessage("/login", "Registrierung fehlgeschlagen – bitte versuche es erneut.");
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
      ageGroup: optionalString(formData, "age_group")
    }
  });

  revalidatePath("/");
  revalidatePath("/workspaces");
}

export async function createTeamInvite(formData: FormData) {
  const { user, team, membership } = await requireActiveTeam();

  if (!canManageWorkspace(membership.role)) {
    throw new Error("Only lead coaches can invite staff members.");
  }

  const role = enumValue(formData, "role", ["head_coach", "coach"] as const);
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
        throw new Error("Ungültiger Einladungscode.");
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

      let parsedRole: Role = "TRAINER";
      if (invite.role === "head_coach") {
        parsedRole = "HEAD_COACH";
      } else if (invite.role === "coach") {
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
export async function createPlayer(formData: FormData) {
  const { team } = await requireActiveTeam();
  const { firstName, lastName, name } = playerName(formData);

  await db.player.create({
    data: {
      workspaceId: team.id,
      name,
      firstName,
      lastName,
      position: optionalString(formData, "position"),
      birthYear: optionalNumber(formData, "birth_year"),
      jerseyNumber: optionalNumber(formData, "jersey_number")
    }
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function importPlayers(formData: FormData) {
  const { team } = await requireActiveTeam();
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

    const [firstColumn, secondColumn, position, birthYear, jerseyNumber] = columns;
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
        workspaceId: team.id,
        name,
        firstName,
        lastName,
        position: position || null,
        birthYear:
          parsedBirthYear !== null && Number.isFinite(parsedBirthYear)
            ? parsedBirthYear
            : null,
        jerseyNumber:
          parsedJerseyNumber !== null && Number.isFinite(parsedJerseyNumber)
            ? parsedJerseyNumber
            : null
      }
    ];
  });

  if (rows.length === 0) {
    throw new Error("No players found in import.");
  }

  await db.player.createMany({
    data: rows
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function updatePlayer(formData: FormData) {
  const { team } = await requireActiveTeam();
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

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });
  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.player.update({
    where: { id },
    data: {
      name,
      firstName,
      lastName,
      position: optionalString(formData, "position"),
      secondaryPositions:
        optionalString(formData, "secondary_positions")
          ?.split(",")
          .map((item) => item.trim())
          .filter(Boolean) ?? [],
      birthDate: optionalString(formData, "birth_date") ? new Date(optionalString(formData, "birth_date")!) : null,
      birthYear: optionalNumber(formData, "birth_year"),
      jerseyNumber: optionalNumber(formData, "jersey_number"),
      photoUrl: optionalString(formData, "photo_url"),
      strongFoot,
      height: optionalNumber(formData, "height_cm"),
      weight: optionalNumber(formData, "weight_kg"),
      contact: optionalString(formData, "contact"),
      parentContact: optionalString(formData, "parent_contact"),
      emergencyContact: optionalString(formData, "emergency_contact"),
      playerAccountEmail: optionalString(formData, "player_account_email")?.toLowerCase() ?? null,
      favoriteTeam: optionalString(formData, "favorite_team"),
      favoritePlayer: optionalString(formData, "favorite_player"),
      footballGoals: optionalString(formData, "football_goals"),
      motivation: optionalString(formData, "motivation"),
      allergies: optionalString(formData, "allergies"),
      injuries: optionalString(formData, "injuries"),
      limitations: optionalString(formData, "limitations"),
      medications: optionalString(formData, "medications"),
      coachAlerts: optionalString(formData, "coach_alerts"),
      seasonFormCompletedAt:
        formData.get("season_form_completed") === "on"
          ? new Date()
          : null,
      medicalNotes: optionalString(formData, "medical_notes"),
      strengths: optionalString(formData, "strengths"),
      weaknesses: optionalString(formData, "weaknesses"),
      developmentGoals: optionalString(formData, "development_goals"),
      trainingNotes: optionalString(formData, "training_notes"),
      personalNotes: optionalString(formData, "personal_notes"),
      notes: optionalString(formData, "notes"),
      status: status ?? "available",
      rating: optionalNumber(formData, "rating")
    }
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  revalidatePath("/tactics");
}

export async function deletePlayer(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Player");

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.player.delete({
    where: { id }
  });

  await cacheDel(`leaderboard:${team.id}:players`);

  revalidatePath("/");
  revalidatePath("/materials");
  revalidatePath("/pitch");
  revalidatePath("/players");
  revalidatePath("/tactics");
}

export async function rotatePlayerAccessToken(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Player");

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });
  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  // Issuing a fresh token immediately invalidates the previous share link
  // (e.g. when a link leaked in a family chat).
  await db.player.update({
    where: { id },
    data: { accessToken: randomUUID() }
  });

  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
  revalidatePath("/player-mode");
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
  const { team } = await requireActiveTeam();
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

  const player = await db.player.findFirst({
    where: { id: playerId, workspaceId: team.id },
    select: { id: true, photoUrl: true }
  });

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

  const supabase = await createClient();
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

  try {
    await db.player.update({
      where: { id: playerId },
      data: { photoUrl: publicUrlData.publicUrl }
    });
  } catch (updateError: any) {
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([path]);
    throw new Error(updateError.message);
  }

  if (player.photoUrl) {
    const oldPath = pathFromPublicUrl(player.photoUrl, PLAYER_PHOTO_BUCKET);
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
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const player = await db.player.findFirst({
    where: { id: playerId, workspaceId: team.id },
    select: { id: true, photoUrl: true }
  });

  if (!player) {
    throw new Error("Spieler nicht gefunden.");
  }
  if (!player.photoUrl) {
    return;
  }

  const oldPath = pathFromPublicUrl(player.photoUrl, PLAYER_PHOTO_BUCKET);
  const supabase = await createClient();
  if (oldPath) {
    await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([oldPath]);
  }

  await db.player.update({
    where: { id: playerId },
    data: { photoUrl: null }
  });

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
  const { team } = await requireActiveTeam();
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

export async function submitPlayerSeasonForm(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "player_id", "Player");
  const strongFoot = enumValue(formData, "strong_foot", [
    "left",
    "right",
    "both"
  ] as const) as StrongFoot | null;

  const player = await db.player.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.player.update({
    where: { id },
    data: {
      strongFoot,
      contact: optionalString(formData, "contact"),
      parentContact: optionalString(formData, "parent_contact"),
      emergencyContact: optionalString(formData, "emergency_contact"),
      favoriteTeam: optionalString(formData, "favorite_team"),
      favoritePlayer: optionalString(formData, "favorite_player"),
      footballGoals: optionalString(formData, "football_goals"),
      motivation: optionalString(formData, "motivation"),
      strengths: optionalString(formData, "strengths"),
      weaknesses: optionalString(formData, "weaknesses"),
      allergies: optionalString(formData, "allergies"),
      injuries: optionalString(formData, "injuries"),
      limitations: optionalString(formData, "limitations"),
      medications: optionalString(formData, "medications"),
      seasonFormCompletedAt: new Date()
    }
  });

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
    date: new Date(requiredString(formData, "date", "Training date")),
    startTime: optionalString(formData, "start_time"),
    durationMinutes: optionalNumber(formData, "duration_minutes") ?? 90,
    duration: optionalNumber(formData, "duration_minutes") ?? 90,
    location: optionalString(formData, "location"),
    focus: optionalString(formData, "focus") ?? "",
    goal: optionalString(formData, "goal"),
    ageGroup: optionalString(formData, "age_group"),
    intensity,
    participants: optionalString(formData, "participants"),
    notes: optionalString(formData, "notes"),
    isTemplate: formData.get("is_template") === "on",
    templateName: optionalString(formData, "template_name")
  };
}

function phaseRows(
  formData: FormData,
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
        trainingId: trainingId,
        phaseType: phaseType as TrainingPhaseType,
        title: title ?? phaseType.replace("_", " "),
        durationMinutes: duration,
        description,
        coachingPoints: optionalString(formData, `${phaseType}_coaching`),
        organization: optionalString(formData, `${phaseType}_organization`),
        material: optionalString(formData, `${phaseType}_material`),
        playerCount: optionalString(formData, `${phaseType}_players`),
        fieldSize: optionalString(formData, `${phaseType}_field`),
        variations: optionalString(formData, `${phaseType}_variations`),
        loadManagement: optionalString(formData, `${phaseType}_load`),
        imageUrls: imagesByType?.get(phaseType) ?? [],
        sortOrder: index
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
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

export async function deleteTacticBoard(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Taktikboard");

  const board = await db.tacticBoard.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!board) {
    throw new Error("Tactic board not found or unauthorized.");
  }

  await db.tacticBoard.delete({
    where: { id }
  });

  revalidatePath("/tactics");
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
    throw new Error("Ungültiges Diagramm-Format");
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
      duration: training.duration,
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

export async function createAiTrainingDraft(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const focus = requiredString(formData, "focus", "Schwerpunkt");
  const duration = optionalNumber(formData, "duration_minutes") ?? 90;
  const ageGroup = optionalString(formData, "age_group") ?? team.age_group;
  const date = requiredString(formData, "date", "Datum");
  const additionalContext = optionalString(formData, "context") ?? "";

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert. Bitte in .env.local setzen.");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [players, checkins, recentTrainings, nextMatch] = await Promise.all([
    db.player.findMany({
      where: { workspaceId: team.id },
      orderBy: { name: "asc" }
    }),
    db.healthCheck.findMany({
      where: {
        player: { workspaceId: team.id },
        date: { gte: sevenDaysAgo }
      },
      orderBy: { date: "desc" }
    }),
    db.training.findMany({
      where: {
        workspaceId: team.id,
        date: { lt: new Date(date) }
      },
      orderBy: { date: "desc" },
      take: 4
    }),
    db.match.findFirst({
      where: {
        workspaceId: team.id,
        date: { gte: new Date(date) }
      },
      orderBy: { date: "asc" }
    })
  ]);

  const latestByPlayer = new Map<string, typeof checkins[number]>();
  for (const c of checkins) {
    if (!latestByPlayer.has(c.playerId)) {
      latestByPlayer.set(c.playerId, c);
    }
  }

  const available = players.filter((p: any) => p.status === "available" || !p.status);
  const limited = players.filter((p: any) => p.status === "limited");
  const injured = players.filter((p: any) => p.status === "injured");

  const wellnessLines = players
    .map((player: any) => {
      const c = latestByPlayer.get(player.id);
      if (!c) return `- ${player.name}: Kein aktueller Check-in`;

      const snakeCaseCheckin = {
        player_id: c.playerId,
        checkin_date: c.date.toISOString().slice(0, 10),
        fatigue: c.fatigue,
        sleep_quality: c.sleepQuality ?? 3,
        soreness: c.soreness,
        pain: c.pain,
        stress: c.stress,
        motivation: c.motivation,
        energy: c.energy ?? 3,
        injury_feeling: c.injuryFeeling ?? 3,
        wellbeing: c.wellbeing ?? 3,
      };

      const risk = healthRisk(snakeCaseCheckin);
      const label =
        risk === "red"
          ? "🔴 ROT – unbedingt schonen!"
          : risk === "yellow"
            ? "🟡 GELB – beobachten"
            : "✅ GUT";
      return `- ${player.name}: Müdigkeit ${c.fatigue}/5, Schmerzen ${c.pain}/5, Energie ${c.energy ?? 3}/5, Stress ${c.stress}/5, Schlaf ${c.sleepQuality ?? 3}/5 → ${label}`;
    })
    .join("\n");

  const recentLines =
    recentTrainings.length > 0
      ? recentTrainings.map((t: any) => `- ${t.date.toISOString().slice(0, 10)}: ${t.focus} (${t.intensity ?? "?"} Intensität)`).join("\n")
      : "- Noch keine Trainings erfasst";

  const daysToMatch = nextMatch
    ? Math.round((new Date(nextMatch.date).getTime() - new Date(date).getTime()) / 86400000)
    : null;
  const matchLine = nextMatch
    ? `${nextMatch.date.toISOString().slice(0, 10)} gegen ${nextMatch.opponent}${nextMatch.kickoffTime ? ` · Anpfiff ${nextMatch.kickoffTime.slice(0, 5)} Uhr` : ""} — ${daysToMatch} Tag(e) bis zum Spiel`
    : "Kein Spiel in den nächsten 14 Tagen geplant";

  const plan = await generateTrainingPlan({
    teamName: team.name,
    ageGroup,
    totalPlayers: players.length,
    availableCount: available.length,
    limitedCount: limited.length,
    injuredCount: injured.length,
    date,
    durationMinutes: duration,
    focus,
    additionalContext,
    wellnessLines,
    recentLines,
    matchLine
  });

  const validIntensities: TrainingIntensity[] = ["low", "medium", "high"];
  const intensity: TrainingIntensity = validIntensities.includes(plan.intensity as TrainingIntensity)
    ? (plan.intensity as TrainingIntensity)
    : "medium";

  const training = await db.training.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: plan.focus || focus,
      date: new Date(date),
      durationMinutes: duration,
      duration: duration,
      focus: plan.focus || focus,
      goal: plan.goal,
      intensity,
      notes: plan.notes
    }
  });

  const phaseRows = (plan.phases ?? []).map((phase: any, index: number) => ({
    trainingId: training.id,
    phaseType: (phase.phase_type ?? "technique") as TrainingPhaseType,
    title: phase.title ?? "",
    durationMinutes: phase.duration_minutes ?? null,
    description: phase.description ?? null,
    coachingPoints: phase.coaching_points ?? null,
    organization: phase.organization ?? null,
    material: phase.material ?? null,
    variations: phase.variations ?? null,
    loadManagement: phase.load_management ?? null,
    diagram: (phase.diagram ?? null) as any,
    sortOrder: index
  }));

  if (phaseRows.length > 0) {
    await db.trainingPhase.createMany({
      data: phaseRows
    });
  }

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
      duration: duration,
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
      "Timing, Abstände, Kommunikation und Entscheidungsqualität aktiv coachen.",
    organization:
      "Feldgröße und Spielerzahl an Kadergröße anpassen; klare Wechsel- und Pausenregeln setzen.",
    material: "Bälle, Hütchen, Markierungsteller, Leibchen, Tore",
    playerCount: "12-18",
    fieldSize: "Variabel",
    variations:
      "Leichter: mehr Raum und freie Kontakte. Schwerer: Kontaktlimit, Zeitdruck oder kleinere Zonen.",
    loadManagement:
      preset.intensity === "high"
        ? "Kurze intensive Blöcke mit klaren Pausen."
        : "Mittlere Belastung mit fließenden Übergängen.",
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
  const { user, team } = await requireActiveTeam();
  const payload = matchPayload(formData);

  await db.match.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      opponent: payload.opponent,
      date: new Date(payload.date),
      competition: payload.competition,
      kickoffTime: payload.kickoff_time,
      location: payload.location,
      home: payload.home_away === "home",
      homeAway: payload.home_away,
      meetingPoint: payload.meeting_point,
      squadNotes: payload.squad_notes,
      startingLineup: payload.starting_lineup,
      substitutes: payload.substitutes,
      formation: payload.formation,
      tacticalInstructions: payload.tactical_instructions,
      matchGoals: payload.match_goals,
      preMatchNotes: payload.pre_match_notes,
      halftimeNotes: payload.halftime_notes,
      postMatchNotes: payload.post_match_notes,
      result: payload.result,
      scorers: payload.scorers,
      assists: payload.assists,
      cards: payload.cards,
      conclusion: payload.conclusion,
      notes: payload.notes
    }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

export async function updateMatch(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Match");

  const match = await db.match.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!match) {
    throw new Error("Match not found or unauthorized.");
  }

  const payload = matchPayload(formData);

  await db.match.update({
    where: { id },
    data: {
      opponent: payload.opponent,
      date: new Date(payload.date),
      competition: payload.competition,
      kickoffTime: payload.kickoff_time,
      location: payload.location,
      home: payload.home_away === "home",
      homeAway: payload.home_away,
      meetingPoint: payload.meeting_point,
      squadNotes: payload.squad_notes,
      startingLineup: payload.starting_lineup,
      substitutes: payload.substitutes,
      formation: payload.formation,
      tacticalInstructions: payload.tactical_instructions,
      matchGoals: payload.match_goals,
      preMatchNotes: payload.pre_match_notes,
      halftimeNotes: payload.halftime_notes,
      postMatchNotes: payload.post_match_notes,
      result: payload.result,
      scorers: payload.scorers,
      assists: payload.assists,
      cards: payload.cards,
      conclusion: payload.conclusion,
      notes: payload.notes
    }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

export async function deleteMatch(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Match");

  const match = await db.match.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!match) {
    throw new Error("Match not found or unauthorized.");
  }

  await db.match.delete({
    where: { id }
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/pitch");
}

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
      status: player.status === "FIT" ? "available" : player.status === "INJURED" ? "injured" : player.status === "REHAB" ? "limited" : player.status.toLowerCase()
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
      `Intensität: ${training.intensity ?? "-"}`,
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
  const { user, team } = await requireActiveTeam();

  const players = await db.player.findMany({
    where: { workspaceId: team.id },
    select: { id: true, name: true, position: true, jerseyNumber: true },
    orderBy: [
      { jerseyNumber: "asc" },
      { name: "asc" }
    ]
  });

  const mappedPlayers = players.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    jersey_number: p.jerseyNumber
  }));

  await db.tacticBoard.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: requiredString(formData, "title", "Board title"),
      description: optionalString(formData, "description"),
      elements: {
        version: 2,
        scenes: [
          {
            id: "scene-1",
            name: "Grundformation",
            elements: [
              ...tacticRosterElements(mappedPlayers),
              { id: "ball", type: "ball", label: "", x: 53, y: 58 }
            ]
          }
        ]
      }
    }
  });

  revalidatePath("/tactics");
}

export async function saveTacticBoard(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Tactic board");
  const elementsRaw = requiredString(formData, "elements", "Board elements");

  let elements: unknown;
  try {
    elements = JSON.parse(elementsRaw);
  } catch {
    throw new Error("Board elements are invalid.");
  }

  const board = await db.tacticBoard.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!board) {
    throw new Error("Tactic board not found or unauthorized.");
  }

  await db.tacticBoard.update({
    where: { id },
    data: {
      title: requiredString(formData, "title", "Board title"),
      description: optionalString(formData, "description"),
      elements: elements as any
    }
  });

  revalidatePath("/tactics");
}

export async function createTask(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const dueDateStr = optionalString(formData, "due_date");

  await db.task.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      title: requiredString(formData, "title", "Task"),
      dueDate: dueDateStr ? new Date(dueDateStr) : null,
      relatedType: optionalString(formData, "related_type")
    }
  });

  revalidatePath("/");
  revalidatePath("/pitch");
}

export async function toggleTask(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Task");
  const status = enumValue(formData, "status", ["open", "done"] as const);

  const task = await db.task.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!task) {
    throw new Error("Task not found or unauthorized.");
  }

  await db.task.update({
    where: { id },
    data: { status: status === "done" ? "open" : "done" }
  });

  revalidatePath("/");
  revalidatePath("/pitch");
}

export async function addFeedback(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const player = await db.player.findFirst({
    where: { id: playerId, workspaceId: team.id }
  });

  if (!player) {
    throw new Error("Player not found or unauthorized.");
  }

  await db.playerFeedback.create({
    data: {
      workspaceId: team.id,
      playerId: playerId,
      rating: requiredRating(formData),
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
}

export async function addWinnerPoints(formData: FormData) {
  const { team } = await requireActiveTeam();
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

  const awardedAtStr = optionalString(formData, "awarded_at") ?? new Date().toISOString().slice(0, 10);
  const dateObj = new Date(`${awardedAtStr}T00:00:00`);

  const contextMap: Record<WinnerPointContextType, "TRAINING" | "MATCH" | "EVENT"> = {
    training: "TRAINING",
    monday_training: "TRAINING",
    match: "MATCH",
    event: "EVENT",
    other: "EVENT"
  };

  await db.winnerPoint.create({
    data: {
      workspaceId: team.id,
      playerId,
      context: contextMap[contextType] ?? "TRAINING",
      contextType,
      contextId: optionalString(formData, "context_id"),
      contextLabel: optionalString(formData, "context_label"),
      points,
      reason: optionalString(formData, "reason"),
      date: dateObj,
      awardedAt: dateObj
    }
  });

  await cacheDel(`leaderboard:${team.id}:points`);

  revalidatePath("/");
  revalidatePath("/winnerpunkte");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updateWinnerPoints(formData: FormData) {
  const { team } = await requireActiveTeam();
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

  const awardedAtStr = optionalString(formData, "awarded_at") ?? new Date().toISOString().slice(0, 10);
  const dateObj = new Date(`${awardedAtStr}T00:00:00`);

  const contextMap: Record<WinnerPointContextType, "TRAINING" | "MATCH" | "EVENT"> = {
    training: "TRAINING",
    monday_training: "TRAINING",
    match: "MATCH",
    event: "EVENT",
    other: "EVENT"
  };

  const wp = await db.winnerPoint.findFirst({
    where: {
      id,
      workspaceId: team.id
    }
  });

  if (!wp) {
    throw new Error("WinnerPoint not found.");
  }

  await db.winnerPoint.update({
    where: { id },
    data: {
      playerId,
      context: contextMap[contextType] ?? "TRAINING",
      contextType,
      contextId: optionalString(formData, "context_id"),
      contextLabel: optionalString(formData, "context_label"),
      points,
      reason: optionalString(formData, "reason"),
      date: dateObj,
      awardedAt: dateObj
    }
  });

  await cacheDel(`leaderboard:${team.id}:points`);

  revalidatePath("/");
  revalidatePath("/winnerpunkte");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deleteWinnerPoints(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Winnerpunkte");
  const playerId = optionalString(formData, "player_id");

  const wp = await db.winnerPoint.findFirst({
    where: {
      id,
      workspaceId: team.id
    }
  });

  if (!wp) {
    throw new Error("WinnerPoint not found.");
  }

  await db.winnerPoint.delete({
    where: { id }
  });

  await cacheDel(`leaderboard:${team.id}:points`);

  revalidatePath("/");
  revalidatePath("/winnerpunkte");
  revalidatePath("/clubcorner");
  revalidatePath("/player-mode");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function createExternalLink(formData: FormData) {
  const { user, team } = await requireActiveTeam();
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

  await db.externalLink.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      playerId: playerId || null,
      linkType: linkType,
      title: requiredString(formData, "title", "Title"),
      url,
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function updateExternalLink(formData: FormData) {
  const { team } = await requireActiveTeam();
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

  const existing = await db.externalLink.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!existing) {
    throw new Error("Link not found or unauthorized.");
  }

  await db.externalLink.update({
    where: { id },
    data: {
      playerId: playerId || null,
      linkType: linkType,
      title: requiredString(formData, "title", "Title"),
      url: normalizeExternalUrl(requiredString(formData, "url", "URL")),
      notes: optionalString(formData, "notes")
    }
  });

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function deleteExternalLink(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Link");
  const playerId = optionalString(formData, "player_id");

  const existing = await db.externalLink.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!existing) {
    throw new Error("Link not found or unauthorized.");
  }

  await db.externalLink.delete({
    where: { id }
  });

  revalidatePath("/clubcorner");
  revalidatePath("/players");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function savePlayerEvaluation(formData: FormData) {
  const { user, team } = await requireActiveTeam();
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

  const scores = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].filter((v): v is number => v !== null);
  const average = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : null;

  let contextEnum: "TRAINING" | "MATCH" | "EVENT" = "TRAINING";
  if (contextType === "match") {
    contextEnum = "MATCH";
  } else if (contextType === "event") {
    contextEnum = "EVENT";
  }

  await db.rating.create({
    data: {
      playerId: row.player_id,
      raterId: row.user_id,
      date: new Date(row.evaluation_date),
      context: contextEnum,
      contextType: row.context_type,
      contextId: row.context_id,
      contextLabel: row.context_label,
      participation: row.participation,
      motivation: row.motivation,
      trainingQuality: row.training_quality,
      matchQuality: row.match_quality,
      behavior: row.behavior,
      effort: row.effort,
      concentration: row.concentration,
      notes: row.notes,
      average: average,
    }
  });

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updatePlayerEvaluation(formData: FormData) {
  const { team } = await requireActiveTeam();
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

  const rating = await db.rating.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!rating) {
    throw new Error("Evaluation not found or unauthorized");
  }

  const scores = [
    row.participation,
    row.motivation,
    row.training_quality,
    row.match_quality,
    row.behavior,
    row.effort,
    row.concentration
  ].filter((v): v is number => v !== null);
  const average = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : null;

  let contextEnum: "TRAINING" | "MATCH" | "EVENT" = "TRAINING";
  if (contextType === "match") {
    contextEnum = "MATCH";
  } else if (contextType === "event") {
    contextEnum = "EVENT";
  }

  await db.rating.update({
    where: { id },
    data: {
      playerId: row.player_id,
      date: new Date(row.evaluation_date),
      context: contextEnum,
      contextType: row.context_type,
      contextId: row.context_id,
      contextLabel: row.context_label,
      participation: row.participation,
      motivation: row.motivation,
      trainingQuality: row.training_quality,
      matchQuality: row.match_quality,
      behavior: row.behavior,
      effort: row.effort,
      concentration: row.concentration,
      notes: row.notes,
      average: average,
    }
  });

  revalidatePath("/");
  revalidatePath("/evaluations");
  revalidatePath("/clubcorner");
  revalidatePath("/monday");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deletePlayerEvaluation(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Evaluation");
  const playerId = optionalString(formData, "player_id");

  const rating = await db.rating.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!rating) {
    throw new Error("Evaluation not found or unauthorized");
  }

  await db.rating.delete({
    where: { id }
  });

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
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "free"
  ] as const) as HealthContextType | null;

  const checkinDateStr = optionalString(formData, "checkin_date") ?? new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(checkinDateStr);
  const typeStr = contextType ?? "training";

  const fatigue = scaleFive(formData, "fatigue", "Fatigue");
  const sleep_quality = scaleFive(formData, "sleep_quality", "Sleep quality");
  const soreness = scaleFive(formData, "soreness", "Soreness");
  const pain = scaleFive(formData, "pain", "Pain");
  const stress = scaleFive(formData, "stress", "Stress");
  const motivation = scaleFive(formData, "motivation", "Motivation");
  const energy = scaleFive(formData, "energy", "Energy");
  const injury_feeling = scaleFive(formData, "injury_feeling", "Injury feeling");
  const wellbeing = scaleFive(formData, "wellbeing", "Wellbeing");
  const notes = optionalString(formData, "notes");

  const contextEnum =
    typeStr === "match"
      ? "PRE_MATCH"
      : typeStr === "training"
      ? "PRE_TRAINING"
      : "PRE_TRAINING";

  const existing = await db.healthCheck.findFirst({
    where: {
      playerId,
      date: parsedDate,
      contextType: typeStr
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
        playerId,
        date: parsedDate,
        contextType: typeStr,
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

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updateHealthCheckin(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Health check-in");
  const playerId = requiredString(formData, "player_id", "Player");
  const contextType = enumValue(formData, "context_type", [
    "training",
    "match",
    "free"
  ] as const) as HealthContextType | null;

  const checkinDateStr = optionalString(formData, "checkin_date") ?? new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(checkinDateStr);
  const typeStr = contextType ?? "training";

  const checkin = await db.healthCheck.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!checkin) {
    throw new Error("Health check-in not found or unauthorized");
  }

  const fatigue = scaleFive(formData, "fatigue", "Fatigue");
  const sleep_quality = scaleFive(formData, "sleep_quality", "Sleep quality");
  const soreness = scaleFive(formData, "soreness", "Soreness");
  const pain = scaleFive(formData, "pain", "Pain");
  const stress = scaleFive(formData, "stress", "Stress");
  const motivation = scaleFive(formData, "motivation", "Motivation");
  const energy = scaleFive(formData, "energy", "Energy");
  const injury_feeling = scaleFive(formData, "injury_feeling", "Injury feeling");
  const wellbeing = scaleFive(formData, "wellbeing", "Wellbeing");
  const notes = optionalString(formData, "notes");

  const contextEnum =
    typeStr === "match"
      ? "PRE_MATCH"
      : typeStr === "training"
      ? "PRE_TRAINING"
      : "PRE_TRAINING";

  await db.healthCheck.update({
    where: { id },
    data: {
      playerId,
      date: parsedDate,
      contextType: typeStr,
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

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deleteHealthCheckin(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Health check-in");
  const playerId = optionalString(formData, "player_id");

  const checkin = await db.healthCheck.findFirst({
    where: {
      id,
      player: {
        workspaceId: team.id
      }
    }
  });

  if (!checkin) {
    throw new Error("Health check-in not found or unauthorized");
  }

  await db.healthCheck.delete({
    where: { id }
  });

  revalidatePath("/");
  revalidatePath("/health");
  revalidatePath("/player-mode");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}

export async function createCoachMessage(formData: FormData) {
  const { user, team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");
  const body = requiredString(formData, "body", "Body");
  const title = optionalString(formData, "title");
  const category = (enumValue(formData, "category", [
    "training_goal",
    "match_goal",
    "note",
    "praise"
  ] as const) ?? "note") as CoachMessageCategory;

  const fullBody = title ? `**${title}**\n\n${body}` : body;

  await db.coachMessage.create({
    data: {
      workspaceId: team.id,
      playerId,
      userId: user.id,
      category,
      body: fullBody
    }
  });

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/");
}

export async function deleteCoachMessage(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Message");
  const playerId = optionalString(formData, "player_id");

  const message = await db.coachMessage.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!message) {
    throw new Error("Message not found or unauthorized.");
  }

  await db.coachMessage.delete({
    where: { id }
  });

  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
  revalidatePath("/");
}

export async function saveMatchAnalysis(formData: FormData) {
  const { team } = await requireActiveTeam();
  const matchId = requiredString(formData, "match_id", "Match");

  const match = await db.match.findFirst({
    where: { id: matchId, workspaceId: team.id }
  });

  if (!match) {
    throw new Error("Match not found or unauthorized.");
  }

  const opponentAnalysis = optionalString(formData, "opponent_analysis");
  const preparation = optionalString(formData, "match_preparation");
  const matchTargets = optionalString(formData, "match_targets");
  const lineupNotes = optionalString(formData, "lineup_notes");
  const wentWell = optionalString(formData, "went_well");
  const needsWork = optionalString(formData, "needs_work");
  const keyMoments = optionalString(formData, "key_moments");
  const individualPerformances = optionalString(formData, "individual_performances");
  const teamPerformance = optionalString(formData, "team_performance");
  const tacticalLessons = optionalString(formData, "tactical_lessons");
  const nextTrainingFocus = optionalString(formData, "next_training_focus");

  await db.matchAnalysis.upsert({
    where: { matchId },
    create: {
      matchId,
      opponentAnalysis,
      preparation,
      matchTargets,
      lineupNotes,
      wentWell,
      needsWork,
      keyMoments,
      individualPerformances,
      teamPerformance,
      tacticalLessons,
      nextTrainingFocus
    },
    update: {
      opponentAnalysis,
      preparation,
      matchTargets,
      lineupNotes,
      wentWell,
      needsWork,
      keyMoments,
      individualPerformances,
      teamPerformance,
      tacticalLessons,
      nextTrainingFocus
    }
  });

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
  const { user, team } = await requireActiveTeam();
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
        workspaceId: team.id,
        userId: user.id,
        date: new Date(date),
        opponent,
        kickoffTime: kickoffTime || null,
        location: location || null,
        home: homeAway === "home",
        homeAway: (["home", "away", "neutral"].includes(homeAway)
          ? homeAway
          : null),
        competition: competition || null,
        result: result || null
      }
    ];
  });

  if (rows.length === 0) {
    throw new Error("No valid matches found in import.");
  }

  await db.match.createMany({
    data: rows
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/matches");
  revalidatePath("/analysis");
}

export async function createMondayTraining(formData: FormData) {
  const { user, team } = await requireActiveTeam();

  await db.mondayTraining.create({
    data: {
      workspaceId: team.id,
      userId: user.id,
      date: new Date(requiredString(formData, "date", "Date")),
      topic: requiredString(formData, "topic", "Topic"),
      goal: optionalString(formData, "goal"),
      durationMinutes: optionalNumber(formData, "duration_minutes"),
      staffNotes: optionalString(formData, "staff_notes"),
      sanduNotes: optionalString(formData, "sandu_notes")
    }
  });

  revalidatePath("/monday");
}

export async function updateMondayTraining(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Monday training");

  const training = await db.mondayTraining.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!training) {
    throw new Error("Monday training not found or unauthorized.");
  }

  await db.mondayTraining.update({
    where: { id },
    data: {
      date: new Date(requiredString(formData, "date", "Date")),
      topic: requiredString(formData, "topic", "Topic"),
      goal: optionalString(formData, "goal"),
      durationMinutes: optionalNumber(formData, "duration_minutes"),
      staffNotes: optionalString(formData, "staff_notes"),
      sanduNotes: optionalString(formData, "sandu_notes")
    }
  });

  revalidatePath("/monday");
}

export async function deleteMondayTraining(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Monday training");

  const training = await db.mondayTraining.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!training) {
    throw new Error("Monday training not found or unauthorized.");
  }

  await db.mondayTraining.delete({
    where: { id }
  });

  revalidatePath("/monday");
}

export async function saveMondayAttendance(formData: FormData) {
  const { team } = await requireActiveTeam();
  const mondayTrainingId = requiredString(formData, "monday_training_id", "Monday training");
  const playerIds = formData.getAll("player_id").map(String);
  const presentIds = new Set(formData.getAll("present_player_id").map(String));
  const injuredIds = new Set(formData.getAll("injured_player_id").map(String));

  const training = await db.mondayTraining.findFirst({
    where: { id: mondayTrainingId, workspaceId: team.id }
  });

  if (!training) {
    throw new Error("Monday training not found or unauthorized.");
  }

  const rows = playerIds.map((playerId) => {
    const status: MondayAttendanceStatus = injuredIds.has(playerId)
      ? "injured"
      : presentIds.has(playerId)
        ? "present"
        : "absent";

    return {
      mondayTrainingId,
      playerId,
      status,
      note: optionalString(formData, `note_${playerId}`)
    };
  });

  for (const row of rows) {
    await db.mondayAttendance.upsert({
      where: {
        mondayTrainingId_playerId: {
          mondayTrainingId: row.mondayTrainingId,
          playerId: row.playerId
        }
      },
      create: {
        mondayTrainingId: row.mondayTrainingId,
        playerId: row.playerId,
        status: row.status,
        note: row.note
      },
      update: {
        status: row.status,
        note: row.note
      }
    });
  }

  revalidatePath("/monday");
}

export async function createPlayerAward(formData: FormData) {
  const { team } = await requireActiveTeam();
  const playerId = requiredString(formData, "player_id", "Player");

  const latest = await db.award.findFirst({
    where: { workspaceId: team.id },
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" }
    ],
    select: { playerId: true }
  });

  await db.award.create({
    data: {
      workspaceId: team.id,
      playerId,
      previousPlayerId: optionalString(formData, "previous_player_id") ?? latest?.playerId ?? null,
      matchId: optionalString(formData, "match_id") || null,
      eventLabel: optionalString(formData, "event_label"),
      event: optionalString(formData, "event_label") ?? "Man of the Week",
      date: new Date(optionalString(formData, "award_date") ?? new Date().toISOString().slice(0, 10)),
      reason: optionalString(formData, "reason")
    }
  });

  revalidatePath("/");
  revalidatePath("/awards");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function updatePlayerAward(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Award");
  const playerId = requiredString(formData, "player_id", "Player");

  const award = await db.award.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!award) {
    throw new Error("Award not found or unauthorized.");
  }

  await db.award.update({
    where: { id },
    data: {
      playerId,
      previousPlayerId: optionalString(formData, "previous_player_id") || null,
      matchId: optionalString(formData, "match_id") || null,
      eventLabel: optionalString(formData, "event_label"),
      event: optionalString(formData, "event_label") ?? "Man of the Week",
      date: new Date(optionalString(formData, "award_date") ?? new Date().toISOString().slice(0, 10)),
      reason: optionalString(formData, "reason")
    }
  });

  revalidatePath("/");
  revalidatePath("/awards");
  revalidatePath("/player-mode");
  revalidatePath(`/players/${playerId}`);
}

export async function deletePlayerAward(formData: FormData) {
  const { team } = await requireActiveTeam();
  const id = requiredString(formData, "id", "Award");
  const playerId = optionalString(formData, "player_id");

  const award = await db.award.findFirst({
    where: { id, workspaceId: team.id }
  });

  if (!award) {
    throw new Error("Award not found or unauthorized.");
  }

  await db.award.delete({
    where: { id }
  });

  revalidatePath("/awards");
  if (playerId) {
    revalidatePath(`/players/${playerId}`);
  }
}
