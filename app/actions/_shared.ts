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

export const phaseTypes: TrainingPhaseType[] = [
  "warmup",
  "activation",
  "technique",
  "tactics",
  "game_form",
  "finish",
  "cooldown"
];

export const trainingPresets = {
  pressing: {
    focus: "Pressing nach Ballverlust",
    goal:
      "Das Team erkennt Umschaltmomente schneller und stellt sofort Druck auf Ball und nÃ¤chste Passoptionen her.",
    intensity: "high" as TrainingIntensity,
    phases: [
      ["warmup", "Aktivierung mit Gegenpressing", 12, "Rondo mit sofortigem Umschalten nach Ballverlust."],
      ["technique", "Erster Druck und Deckungsschatten", 15, "Anlaufwinkel, KÃ¶rperstellung und kurze Sprintwege wiederholen."],
      ["tactics", "Pressingfalle am FlÃ¼gel", 20, "Team verschiebt geschlossen und lenkt den Gegner in die Falle."],
      ["game_form", "6v6+3 Umschaltspiel", 25, "Nach Ballverlust fÃ¼nf Sekunden Vollpressing, danach neu ordnen."],
      ["finish", "Pressing-Wettkampf", 12, "Punkte fÃ¼r Ballgewinne in gefÃ¤hrlichen Zonen."],
      ["cooldown", "Review", 6, "Welche Trigger haben funktioniert? Spielerfeedback sammeln."]
    ]
  },
  buildup: {
    focus: "Spielaufbau gegen hohes Pressing",
    goal:
      "Das Team findet klare Auswege Ã¼ber TorhÃ¼ter, Sechser und diagonale Anschlussaktionen.",
    intensity: "medium" as TrainingIntensity,
    phases: [
      ["warmup", "Passfenster Ã¶ffnen", 12, "Positionsspiel mit offener KÃ¶rperstellung und Scan vor dem ersten Kontakt."],
      ["technique", "Dritter-Mann-Kombinationen", 16, "Klare PassschÃ¤rfe und Anschlusspositionen trainieren."],
      ["tactics", "Aufbau 7v5", 22, "Pressinglinien erkennen und mit Dreiecken Ã¼berspielen."],
      ["game_form", "Halbfeldspiel mit Aufbauzone", 25, "Tore zÃ¤hlen doppelt nach kontrolliertem Aufbau."],
      ["finish", "Spielnaher Abschluss", 10, "Nach Durchbruch Ã¼ber Zentrum oder FlÃ¼gel abschlieÃŸen."],
      ["cooldown", "Prinzipien sichern", 5, "Drei Aufbauprinzipien fÃ¼r das nÃ¤chste Spiel festhalten."]
    ]
  },
  finishing: {
    focus: "Abschluss unter Druck",
    goal:
      "Spieler treffen schneller Entscheidungen im letzten Drittel und kommen unter Gegnerdruck sauber zum Abschluss.",
    intensity: "medium" as TrainingIntensity,
    phases: [
      ["warmup", "Technische Aktivierung", 10, "Ballmitnahme, erster Kontakt und kurze AbschlÃ¼sse."],
      ["technique", "Abschlusswinkel", 18, "Flache und hohe AbschlÃ¼sse nach Zuspiel und Dribbling."],
      ["tactics", "Letzter Pass", 18, "Timing von Tiefenlauf, RÃ¼ckraum und Querpass."],
      ["game_form", "4v4+TorhÃ¼ter", 28, "Abschluss innerhalb von acht Sekunden nach Ballgewinn."],
      ["finish", "Druck-Challenge", 12, "Teamwettkampf mit wechselnden Abschlusszonen."],
      ["cooldown", "Kurzer Review", 4, "Beste Abschlussoptionen und EntscheidungsqualitÃ¤t besprechen."]
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

export function redirectWithMessage(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export function canManageWorkspace(role: Role) {
  // Only the workspace owner may perform destructive/administrative actions.
  // COACH and ASSISTANT have equal (full) day-to-day rights but cannot manage
  // the workspace itself or its members.
  return role === "OWNER";
}

export function inviteCode() {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

export function playerName(formData: FormData) {
  const firstName = requiredString(formData, "first_name", "First name");
  const lastName = requiredString(formData, "last_name", "Last name");
  return { firstName, lastName, name: `${firstName} ${lastName}`.trim() };
}

export function splitPlayerImportLine(line: string) {
  return line
    .split(/\t|;|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function looksLikePlayerImportHeader(line: string) {
  const normalized = line.toLowerCase();
  return (
    normalized.includes("vorname") ||
    normalized.includes("first") ||
    normalized.includes("nachname") ||
    normalized.includes("last")
  );
}

export async function setActiveTeamCookie(teamId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

// SIGN IN & AUTHENTICATION ACTIONS

export const PLAYER_PHOTO_BUCKET = "player-photos";
export const PLAYER_PHOTO_MAX_BYTES = 6 * 1024 * 1024;
export const PLAYER_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

export function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  return url.slice(idx + marker.length).split("?")[0];
}


export const TRAINING_IMAGE_BUCKET = "training-images";
export const TRAINING_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const TRAINING_IMAGE_MAX_PER_PHASE = 8;
export const TRAINING_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif"
]);


export function trainingPayload(formData: FormData) {
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

export function phaseRows(
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


export function matchPayload(formData: FormData) {
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


export type TacticRosterPlayer = {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
};

export const tacticRosterPositions = [
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

export function tacticRosterPosition(index: number) {
  if (index < tacticRosterPositions.length) {
    return tacticRosterPositions[index];
  }

  const benchIndex = index - tacticRosterPositions.length;
  return {
    x: 12 + (benchIndex % 9) * 9.5,
    y: 88 - Math.floor(benchIndex / 9) * 7
  };
}

export function tacticInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.at(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function tacticRosterElements(players: TacticRosterPlayer[]) {
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


export function splitImportLine(line: string) {
  return line.split(/\t|;|,/).map((item) => item.trim());
}

export function looksLikeMatchImportHeader(line: string) {
  const normalized = line.toLowerCase();
  return (
    normalized.includes("gegner") ||
    normalized.includes("opponent") ||
    normalized.includes("datum") ||
    normalized.includes("date")
  );
}

