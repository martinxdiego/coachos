import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Team, TeamMember } from "@/lib/types";

export const ACTIVE_TEAM_COOKIE = "coachos-active-team";

export type TeamMembership = Pick<
  TeamMember,
  "id" | "role" | "team_id" | "user_id" | "created_at"
>;

export interface ActiveTeamContext {
  team: Team;
  membership: TeamMembership;
}

export interface TeamOption {
  team: Team;
  membership: TeamMembership;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function getTeamOptionsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TeamOption[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("team_members")
    .select("id,team_id,user_id,role,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .in(
      "id",
      memberships.map((membership) => membership.team_id)
    )
    .order("created_at", { ascending: true });

  if (teamError) {
    throw new Error(teamError.message);
  }

  const teamById = new Map((teams ?? []).map((team) => [team.id, team]));

  return memberships
    .map((membership) => {
      const team = teamById.get(membership.team_id);
      return team ? { team, membership } : null;
    })
    .filter((option): option is TeamOption => option !== null);
}

async function getActiveTeamForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const teamOptions = await getTeamOptionsForUser(supabase, userId);

  if (teamOptions.length === 0) {
    return { activeTeam: null, teamOptions };
  }

  const cookieStore = await cookies();
  const preferredTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;
  const activeTeam =
    teamOptions.find((option) => option.team.id === preferredTeamId) ??
    teamOptions[0];

  return { activeTeam, teamOptions };
}

export async function getOptionalActiveTeam() {
  const { supabase, user } = await requireUser();
  const { activeTeam, teamOptions } = await getActiveTeamForUser(
    supabase,
    user.id
  );

  return { supabase, user, activeTeam, teamOptions };
}

export async function requireActiveTeam() {
  const { supabase, user } = await requireUser();
  const { activeTeam, teamOptions } = await getActiveTeamForUser(
    supabase,
    user.id
  );

  if (!activeTeam) {
    redirect("/workspaces");
  }

  return {
    supabase,
    user,
    team: activeTeam.team,
    membership: activeTeam.membership,
    teamOptions
  };
}
