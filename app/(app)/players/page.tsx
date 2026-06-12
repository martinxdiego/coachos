import { Suspense } from "react";
import { PlayersRoster, type PlayerRow } from "@/components/players-roster";
import { TeamSignupShare } from "@/components/team-signup-share";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreatePlayerSignupInvite } from "@/lib/invites";

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
  const players = await db.player.findMany({
    where: { workspaceId: teamId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      position: true,
      birthYear: true,
      jerseyNumber: true,
      status: true,
      rating: true,
      developmentGoals: true,
      photoUrl: true,
    },
    orderBy: { lastName: "asc" },
  });

  const mappedPlayers: PlayerRow[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    first_name: p.firstName,
    last_name: p.lastName,
    position: p.position,
    birth_year: p.birthYear,
    team_category: null,
    jersey_number: p.jerseyNumber,
    status: p.status === "FIT" ? "available" : p.status === "INJURED" ? "injured" : p.status === "REHAB" ? "limited" : p.status.toLowerCase() as any,
    rating: p.rating,
    development_goals: p.developmentGoals,
    photo_url: p.photoUrl,
  }));

  return <PlayersRoster players={mappedPlayers} />;
}


export default async function PlayersPage() {
  const { team, user } = await requireActiveTeam();
  const invite = await getOrCreatePlayerSignupInvite(team.id, user.id);

  return (
    <div className="space-y-6">
      <TeamSignupShare
        teamName={team.name}
        teamSignupToken={invite.code}
      />
      <Suspense fallback={<PlayersRosterSkeleton />}>
        <PlayersData teamId={team.id} />
      </Suspense>
    </div>
  );
}
