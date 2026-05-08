import { Suspense } from "react";
import { PlayersRoster, type PlayerRow } from "@/components/players-roster";
import { TeamSignupShare } from "@/components/team-signup-share";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function PlayersRosterSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              className="rounded-2xl border border-border/60 bg-secondary/40 p-4"
              key={i}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

async function PlayersData({ teamId }: { teamId: string }) {
  const supabase = await createClient();
  const { data: players, error } = await supabase
    .from("players")
    .select(
      "id,name,first_name,last_name,position,birth_year,team_category,jersey_number,status,rating,development_goals,photo_url"
    )
    .eq("team_id", teamId)
    .order("last_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return <PlayersRoster players={(players ?? []) as PlayerRow[]} />;
}

export default async function PlayersPage() {
  const { team } = await requireActiveTeam();

  return (
    <div className="space-y-6">
      <TeamSignupShare
        teamName={team.name}
        teamSignupToken={team.player_signup_token}
      />
      <Suspense fallback={<PlayersRosterSkeleton />}>
        <PlayersData teamId={team.id} />
      </Suspense>
    </div>
  );
}
