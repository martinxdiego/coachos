"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { resolvePlayerSignupInvite } from "@/lib/invites";
import { CURRENT_CONSENT_VERSION } from "@/lib/consent";
import { rateLimit } from "@/lib/rate-limit";
import { todayIsoDate } from "@/lib/utils";
import type { HealthContextType } from "@/lib/types";
import { getPlayerPortalSession } from "@/lib/player-session";
import { recordAuditEvent } from "@/lib/audit";
import { assertCanAddPlayers } from "@/lib/billing";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGISTRATION_IP_LIMIT = 10;
const REGISTRATION_TEAM_LIMIT = 40;
const REGISTRATION_WINDOW_SECONDS = 60 * 60 * 24;
const MAX_PLAYERS_PER_WORKSPACE = 100;
const PUBLIC_MUTATION_WINDOW_SECONDS = 60 * 60;
const MAX_NAME_LENGTH = 80;
const MAX_CONTACT_LENGTH = 250;
const MAX_SHORT_TEXT_LENGTH = 120;
const MAX_LONG_TEXT_LENGTH = 2_000;

class RosterLimitError extends Error {}

function isSerializationConflict(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "P2034"
  );
}

function ensureUuid(value: string | null | undefined, label: string): string {
  if (!value || !UUID_RE.test(value)) {
    throw new Error(`${label} ist ungültig.`);
  }
  return value.toLowerCase();
}

function reqString(
  formData: FormData,
  key: string,
  label: string,
  maxLength = MAX_LONG_TEXT_LENGTH
): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} ist erforderlich.`);
  if (value.length > maxLength) {
    throw new Error(`${label} ist zu lang (max. ${maxLength} Zeichen).`);
  }
  return value;
}

function optString(
  formData: FormData,
  key: string,
  maxLength = MAX_LONG_TEXT_LENGTH,
  label = "Eingabe"
): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > maxLength) {
    throw new Error(`${label} ist zu lang (max. ${maxLength} Zeichen).`);
  }
  return value.length > 0 ? value : null;
}

function optNumber(
  formData: FormData,
  key: string,
  label: string,
  min: number,
  max: number
): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error(
      `${label} muss eine ganze Zahl zwischen ${min} und ${max} sein.`
    );
  }
  return num;
}

function optionalIsoDate(
  formData: FormData,
  key: string,
  label: string
): Date | null {
  const value = optString(formData, key, 10, label);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} ist ungültig.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  const currentYear = Number(todayIsoDate().slice(0, 4));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    Number(value.slice(0, 4)) < 1900 ||
    Number(value.slice(0, 4)) > currentYear
  ) {
    throw new Error(`${label} ist ungültig.`);
  }
  return parsed;
}

function scaleFive(formData: FormData, key: string, label: string): number {
  const value = Number(formData.get(key));
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} muss zwischen 1 und 5 liegen.`);
  }
  return value;
}

async function enforcePublicMutationLimit(
  scope: string,
  sessionId: string,
  tokenLimit: number
) {
  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  const [byToken, byIp] = await Promise.all([
    rateLimit(
      `${scope}-session:${sessionId}`,
      tokenLimit,
      PUBLIC_MUTATION_WINDOW_SECONDS
    ),
    rateLimit(
      `${scope}-ip:${clientIp}`,
      Math.max(tokenLimit * 5, 30),
      PUBLIC_MUTATION_WINDOW_SECONDS
    )
  ]);

  if (!byToken.success || !byIp.success) {
    throw new Error(
      "Zu viele Anfragen. Bitte warte kurz und versuche es später erneut."
    );
  }
}

async function findPlayerBySession() {
  const session = await getPlayerPortalSession();
  if (!session) {
    throw new Error(
      "Die Sitzung ist abgelaufen. Bitte öffne deinen Zugangslink erneut."
    );
  }
  const player = await db.player.findFirst({
    where: { id: session.playerId },
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
    session_id: session.id,
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

  // Keep the early guard IP-scoped. Invalid forms must not consume the shared
  // team allowance and lock legitimate players out of registration.
  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  const ipLimit = await rateLimit(
    `self-register-ip:${clientIp}`,
    REGISTRATION_IP_LIMIT,
    REGISTRATION_WINDOW_SECONDS
  );
  if (!ipLimit.success) {
    throw new Error(
      "Zu viele Registrierungen. Bitte später erneut versuchen oder den Trainer kontaktieren."
    );
  }

  // S6.6: Ohne erteilte Eltern-/Erziehungsberechtigten-Einwilligung keine
  // Registrierung — serverseitig erzwungen, nicht nur per Checkbox im Browser.
  const consentGiven = String(formData.get("consent") ?? "").trim();
  if (consentGiven !== "on" && consentGiven !== "true") {
    throw new Error(
      "Die Einwilligung der Eltern/Erziehungsberechtigten ist erforderlich."
    );
  }
  const parentContact = reqString(
    formData,
    "parent_contact",
    "Kontakt der Eltern/Erziehungsberechtigten",
    MAX_CONTACT_LENGTH
  );

  const firstName = reqString(
    formData,
    "first_name",
    "Vorname",
    MAX_NAME_LENGTH
  );
  const lastName = reqString(
    formData,
    "last_name",
    "Nachname",
    MAX_NAME_LENGTH
  );
  const birthDate = optionalIsoDate(formData, "birth_date", "Geburtsdatum");
  const currentYear = Number(todayIsoDate().slice(0, 4));
  const birthYear = optNumber(
    formData,
    "birth_year",
    "Geburtsjahr",
    1900,
    currentYear
  );
  const heightCm = optNumber(
    formData,
    "height_cm",
    "Grösse",
    50,
    250
  );
  const weightKg = optNumber(
    formData,
    "weight_kg",
    "Gewicht",
    15,
    300
  );
  const position = optString(
    formData,
    "position",
    MAX_SHORT_TEXT_LENGTH,
    "Position"
  );
  const jerseyNumber = optNumber(
    formData,
    "jersey_number",
    "Trikotnummer",
    0,
    999
  );

  const fullName = `${firstName} ${lastName}`.trim();

  // Only syntactically valid requests consume the shared team allowance.
  const workspaceLimit = await rateLimit(
    `self-register-workspace:${invite.workspaceId}`,
    REGISTRATION_TEAM_LIMIT,
    REGISTRATION_WINDOW_SECONDS
  );
  if (!workspaceLimit.success) {
    throw new Error(
      "Zu viele Registrierungen. Bitte später erneut versuchen oder den Trainer kontaktieren."
    );
  }
  await assertCanAddPlayers(invite.workspaceId, 1);

  let created: { id: string; accessToken: string } | null = null;
  let transactionError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      created = await db.$transaction(
        async (tx) => {
          const playerCount = await tx.player.count({
            where: { workspaceId: invite.workspaceId }
          });
          if (playerCount >= MAX_PLAYERS_PER_WORKSPACE) {
            throw new RosterLimitError();
          }

          return tx.player.create({
            data: {
              workspaceId: invite.workspaceId,
              name: fullName,
              firstName,
              lastName,
              birthDate,
              birthYear,
              height: heightCm,
              weight: weightKg,
              position,
              jerseyNumber,
              parentContact,
              status: "AVAILABLE",
              selfRegisteredAt: new Date(),
              consentAcceptedAt: new Date(),
              consentVersion: CURRENT_CONSENT_VERSION,
            },
            select: {
              id: true,
              accessToken: true,
            }
          });
        },
        { isolationLevel: "Serializable" }
      );
      break;
    } catch (error) {
      if (error instanceof RosterLimitError) {
        throw new Error(
          "Das Kaderlimit ist erreicht. Bitte den Trainer kontaktieren."
        );
      }
      transactionError = error;
      if (!isSerializationConflict(error)) throw error;
    }
  }

  if (!created) {
    throw transactionError ?? new Error("Registrierung fehlgeschlagen.");
  }

  revalidatePath("/players");
  revalidatePath("/");

  return {
    ok: true,
    accessToken: created.accessToken,
    playerId: created.id
  };
}

export async function submitPublicCheckin(formData: FormData) {
  const player = await findPlayerBySession();
  await enforcePublicMutationLimit("public-checkin", player.session_id, 12);

  // Public players can create or edit today's check-in only. Trusting a
  // hidden browser field would allow forged historical or future health data.
  const checkinDate = todayIsoDate();
  const contextRaw =
    optString(formData, "context_type", 20, "Kontext") ?? "training";
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
  const notes = optString(
    formData,
    "notes",
    MAX_LONG_TEXT_LENGTH,
    "Notiz"
  );

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

  await recordAuditEvent({
    workspaceId: player.team_id,
    event: "player.profile.updated",
    actorPlayerId: player.id,
    targetType: "Player",
    targetId: player.id
  });
  revalidatePath("/player");
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
  formData: FormData
) {
  const player = await findPlayerBySession();
  await enforcePublicMutationLimit("public-season", player.session_id, 10);
  const strongFoot = optString(formData, "strong_foot", 5, "Starker Fuss");
  if (
    strongFoot &&
    strongFoot !== "left" &&
    strongFoot !== "right" &&
    strongFoot !== "both"
  ) {
    throw new Error("Starker Fuss ist ungültig.");
  }

  await db.player.update({
    where: { id: player.id },
    data: {
      contact: optString(
        formData,
        "contact",
        MAX_CONTACT_LENGTH,
        "Kontakt"
      ),
      parentContact: optString(
        formData,
        "parent_contact",
        MAX_CONTACT_LENGTH,
        "Elternkontakt"
      ),
      emergencyContact: optString(
        formData,
        "emergency_contact",
        MAX_CONTACT_LENGTH,
        "Notfallkontakt"
      ),
      strongFoot,
      favoriteTeam: optString(
        formData,
        "favorite_team",
        MAX_SHORT_TEXT_LENGTH,
        "Lieblingsteam"
      ),
      favoritePlayer: optString(
        formData,
        "favorite_player",
        MAX_SHORT_TEXT_LENGTH,
        "Lieblingsspieler"
      ),
      footballGoals: optString(
        formData,
        "football_goals",
        MAX_LONG_TEXT_LENGTH,
        "Fussballziele"
      ),
      strengths: optString(
        formData,
        "strengths",
        MAX_LONG_TEXT_LENGTH,
        "Stärken"
      ),
      weaknesses: optString(
        formData,
        "weaknesses",
        MAX_LONG_TEXT_LENGTH,
        "Entwicklungsfelder"
      ),
      motivation: optString(
        formData,
        "motivation",
        MAX_LONG_TEXT_LENGTH,
        "Motivation"
      ),
      seasonFormCompletedAt: new Date()
    }
  });

  revalidatePath("/player");
  revalidatePath(`/players/${player.id}`);
}

export async function submitPlayerNoteToCoach(
  formData: FormData
) {
  const player = await findPlayerBySession();
  await enforcePublicMutationLimit("public-note", player.session_id, 10);
  const body = reqString(
    formData,
    "body",
    "Notiz",
    MAX_LONG_TEXT_LENGTH
  );
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

  await recordAuditEvent({
    workspaceId: player.team_id,
    event: "player.feedback.created",
    actorPlayerId: player.id,
    targetType: "PlayerFeedback"
  });
  revalidatePath("/player");
  revalidatePath(`/players/${player.id}`);
}

export async function markCoachMessageRead(
  messageId: string
) {
  const player = await findPlayerBySession();
  await enforcePublicMutationLimit(
    "public-message-read",
    player.session_id,
    120
  );
  const id = ensureUuid(messageId, "Mitteilungs-ID");

  const result = await db.coachMessage.updateMany({
    where: {
      id,
      playerId: player.id
    },
    data: { readAt: new Date() }
  });

  if (result.count !== 1) {
    throw new Error("Mitteilung wurde nicht gefunden.");
  }

  await recordAuditEvent({
    workspaceId: player.team_id,
    event: "player.checkin.saved",
    actorPlayerId: player.id,
    targetType: "HealthCheck"
  });
  revalidatePath("/player");
  revalidatePath(`/players/${player.id}`);
}

export async function submitAvailability(formData: FormData) {
  const player = await findPlayerBySession();
  await enforcePublicMutationLimit("public-availability", player.session_id, 60);
  const eventId = ensureUuid(
    String(formData.get("event_id") ?? ""),
    "Termin-ID"
  );
  const eventType = String(formData.get("event_type") ?? "");
  const status = String(formData.get("status") ?? "");
  if (eventType !== "TRAINING" && eventType !== "MATCH") {
    throw new Error("Terminart ist ungültig.");
  }
  if (status !== "YES" && status !== "MAYBE" && status !== "NO") {
    throw new Error("Antwort ist ungültig.");
  }
  const comment = optString(formData, "comment", 500, "Kommentar");

  const eventExists =
    eventType === "TRAINING"
      ? await db.training.count({
          where: { id: eventId, workspaceId: player.team_id }
        })
      : await db.match.count({
          where: { id: eventId, workspaceId: player.team_id }
        });
  if (eventExists !== 1) {
    throw new Error("Termin wurde nicht gefunden.");
  }

  const response = await db.availabilityResponse.upsert({
    where: {
      playerId_eventType_eventId: {
        playerId: player.id,
        eventType,
        eventId
      }
    },
    create: {
      workspaceId: player.team_id,
      playerId: player.id,
      eventType,
      eventId,
      status,
      comment
    },
    update: {
      status,
      comment,
      respondedAt: new Date()
    },
    select: { id: true }
  });
  await recordAuditEvent({
    workspaceId: player.team_id,
    event: "player.availability.updated",
    actorPlayerId: player.id,
    targetType: eventType,
    targetId: eventId,
    metadata: { status }
  });
  revalidatePath("/player");
  revalidatePath("/availability");
  return { ok: true as const, id: response.id, status };
}
