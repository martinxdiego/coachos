"use server";

import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_TEAM_COOKIE, requireActiveTeam, requireUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceStatus,
  HomeAway,
  Json,
  MaterialType,
  PlayerStatus,
  StrongFoot,
  TeamRole,
  TrainingIntensity,
  TrainingPhaseType
} from "@/lib/types";

const phaseTypes: TrainingPhaseType[] = [
  "warmup",
  "technique",
  "tactics",
  "game_form",
  "finish",
  "cooldown"
];

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

function requiredRating(formData: FormData) {
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new Error("Rating must be between 1 and 10.");
  }
  return rating;
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
    birth_year: optionalNumber(formData, "birth_year"),
    jersey_number: optionalNumber(formData, "jersey_number")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/players");
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
      birth_year: optionalNumber(formData, "birth_year"),
      jersey_number: optionalNumber(formData, "jersey_number"),
      photo_url: optionalString(formData, "photo_url"),
      strong_foot: strongFoot,
      height_cm: optionalNumber(formData, "height_cm"),
      weight_kg: optionalNumber(formData, "weight_kg"),
      contact: optionalString(formData, "contact"),
      parent_contact: optionalString(formData, "parent_contact"),
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
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
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
  revalidatePath("/players");
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

function phaseRows(formData: FormData, teamId: string, trainingId: string) {
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

  const { error: deleteError } = await supabase
    .from("training_phases")
    .delete()
    .eq("training_id", id)
    .eq("team_id", team.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows = phaseRows(formData, team.id, id);
  if (rows.length > 0) {
    const { error: phaseError } = await supabase
      .from("training_phases")
      .insert(rows);

    if (phaseError) {
      throw new Error(phaseError.message);
    }
  }

  revalidatePath("/");
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
  revalidatePath("/trainings");
}

export async function createAiTrainingDraft(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();
  const focus = requiredString(formData, "focus", "Training focus");
  const duration = optionalNumber(formData, "duration_minutes") ?? 90;
  const ageGroup = optionalString(formData, "age_group") ?? team.age_group;
  const date = requiredString(formData, "date", "Training date");

  const { data: training, error } = await supabase
    .from("training_sessions")
    .insert({
      team_id: team.id,
      user_id: user.id,
      date,
      duration_minutes: duration,
      focus,
      goal: `AI draft: improve ${focus.toLowerCase()} with a logical load progression.`,
      age_group: ageGroup,
      intensity: "medium",
      notes:
        "AI mock draft. Ready for future model integration: adjust phases, coaching points, variants, and material before using on pitch."
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const base = Math.max(10, Math.floor(duration / 6));
  const rows = [
    ["warmup", "Activation rondo", base, "Mobilize, ball contacts, scanning."],
    ["technique", `${focus} technique`, base + 5, "High repetition, clean execution."],
    ["tactics", `${focus} tactical picture`, base + 5, "Freeze moments and correct distances."],
    ["game_form", "Directional game", base + 10, "Transfer principle into realistic pressure."],
    ["finish", "Competitive finish", base, "Score-driven final block."],
    ["cooldown", "Review and cooldown", 8, "Regenerate and collect player feedback."]
  ].map(([phaseType, title, minutes, description], index) => ({
    team_id: team.id,
    training_id: training.id,
    phase_type: phaseType as TrainingPhaseType,
    title: String(title),
    duration_minutes: Number(minutes),
    description: String(description),
    coaching_points:
      "Observe body shape, timing, communication, and decision quality.",
    organization: "Use clear zones, short coaching stops, and fast restarts.",
    material: "Balls, bibs, cones, small goals",
    player_count: "12-18",
    field_size: "Adapt to squad size",
    variations: "Reduce touches for harder; increase space for easier.",
    load_management: "Medium load with short breaks between blocks.",
    sort_order: index
  }));

  const { error: phaseError } = await supabase.from("training_phases").insert(rows);
  if (phaseError) {
    throw new Error(phaseError.message);
  }

  revalidatePath("/");
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
  revalidatePath("/trainings");
}

function matchPayload(formData: FormData) {
  return {
    opponent: requiredString(formData, "opponent", "Opponent"),
    date: requiredString(formData, "date", "Match date"),
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

  const { error } = await supabase.from("matches").insert({
    team_id: team.id,
    user_id: user.id,
    ...matchPayload(formData)
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/matches");
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
  revalidatePath("/matches");
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
  revalidatePath("/matches");
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

export async function createTacticBoard(formData: FormData) {
  const { supabase, user, team } = await requireActiveTeam();

  const { error } = await supabase.from("tactic_boards").insert({
    team_id: team.id,
    user_id: user.id,
    title: requiredString(formData, "title", "Board title"),
    description: optionalString(formData, "description"),
    elements: [
      { id: "p1", type: "player", label: "6", x: 50, y: 68 },
      { id: "p2", type: "player", label: "10", x: 50, y: 48 },
      { id: "ball", type: "ball", label: "", x: 53, y: 58 }
    ]
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
