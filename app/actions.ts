"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/env";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";

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
    redirect("/");
  }

  redirectWithMessage("/login", "Check your email to confirm the account.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createPlayer(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("players").insert({
    user_id: user.id,
    name: requiredString(formData, "name", "Player name"),
    position: optionalString(formData, "position"),
    notes: optionalString(formData, "notes")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/players");
}

export async function updatePlayer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = requiredString(formData, "id", "Player");

  const { error } = await supabase
    .from("players")
    .update({
      name: requiredString(formData, "name", "Player name"),
      position: optionalString(formData, "position"),
      notes: optionalString(formData, "notes")
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/players");
  revalidatePath(`/players/${id}`);
}

export async function deletePlayer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = requiredString(formData, "id", "Player");

  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/players");
}

export async function createTraining(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("training_sessions").insert({
    user_id: user.id,
    date: requiredString(formData, "date", "Training date"),
    focus: requiredString(formData, "focus", "Training focus"),
    notes: optionalString(formData, "notes")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/trainings");
}

export async function saveAttendance(formData: FormData) {
  const { supabase, user } = await requireUser();
  const trainingId = requiredString(formData, "training_id", "Training");
  const playerIds = formData.getAll("player_id").map(String);
  const presentIds = new Set(formData.getAll("present_player_id").map(String));

  const { error: trainingError } = await supabase
    .from("training_sessions")
    .select("id")
    .eq("id", trainingId)
    .eq("user_id", user.id)
    .single();

  if (trainingError) {
    throw new Error(trainingError.message);
  }

  if (playerIds.length === 0) {
    revalidatePath("/trainings");
    return;
  }

  const { data: players, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.id)
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

export async function createMatch(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("matches").insert({
    user_id: user.id,
    opponent: requiredString(formData, "opponent", "Opponent"),
    date: requiredString(formData, "date", "Match date"),
    notes: optionalString(formData, "notes")
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/matches");
}

export async function saveMatchNotes(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = requiredString(formData, "id", "Match");

  const { error } = await supabase
    .from("matches")
    .update({ notes: optionalString(formData, "notes") })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/matches");
}

export async function addFeedback(formData: FormData) {
  const { supabase, user } = await requireUser();
  const playerId = requiredString(formData, "player_id", "Player");

  const { error } = await supabase.from("player_feedback").insert({
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
