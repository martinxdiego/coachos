import { Suspense } from "react";
import { CreateMatchDrawer } from "@/components/create-match-drawer";
import { MatchImportDrawer } from "@/components/match-import-drawer";
import {
  MatchesRoster,
  type MatchRow,
  type PlayerOption
} from "@/components/matches-roster";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { requireActiveTeam } from "@/lib/auth";
import { todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MatchesPageProps {
  searchParams?: Promise<{
    date?: string;
  }>;
}

function safeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIsoDate();
}

function MatchesSkeleton() {
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
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="grid gap-5 p-6 xl:grid-cols-[320px_1fr]">
              <Skeleton className="h-[280px] rounded-2xl" />
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function MatchesData({
  teamId,
  ageGroup,
  initialDate,
  suggestedLineup,
  suggestedSubstitutes
}: {
  teamId: string;
  ageGroup: string | null;
  initialDate: string;
  suggestedLineup: string;
  suggestedSubstitutes: string;
}) {
  const [matchesData, playersData] = await Promise.all([
    db.match.findMany({
      where: { workspaceId: teamId },
      orderBy: { date: "desc" },
      take: 200,
      include: {
        events: {
          orderBy: { minute: "asc" },
          include: { player: { select: { name: true } } }
        }
      }
    }),
    db.player.findMany({
      where: { workspaceId: teamId },
      select: {
        id: true,
        name: true,
        position: true,
        jerseyNumber: true
      },
      orderBy: [
        { jerseyNumber: "asc" },
        { name: "asc" }
      ]
    })
  ]);

  const matches: MatchRow[] = matchesData.map((m) => ({
    id: m.id,
    opponent: m.opponent,
    date: m.date.toISOString().slice(0, 10),
    events: m.events.map((e) => ({
      id: e.id,
      type: e.type,
      minute: e.minute,
      note: e.note,
      player_id: e.playerId,
      player_name: e.player.name
    })),
    competition: m.competition,
    team_category: null,
    kickoff_time: m.kickoffTime,
    location: m.location,
    home_away: m.homeAway,
    meeting_point: m.meetingPoint,
    squad_notes: m.squadNotes,
    starting_lineup: m.startingLineup,
    substitutes: m.substitutes,
    formation: m.formation,
    tactical_instructions: m.tacticalInstructions,
    match_goals: m.matchGoals,
    pre_match_notes: m.preMatchNotes,
    halftime_notes: m.halftimeNotes,
    post_match_notes: m.postMatchNotes,
    result: m.result,
    scorers: m.scorers,
    assists: m.assists,
    cards: m.cards,
    conclusion: m.conclusion,
    notes: m.notes
  }));

  // Sort players with non-null numbers first, then nulls (to match custom ordering)
  const sortedPlayers = [...playersData].sort((a, b) => {
    if (a.jerseyNumber !== null && b.jerseyNumber === null) return -1;
    if (a.jerseyNumber === null && b.jerseyNumber !== null) return 1;
    if (a.jerseyNumber !== null && b.jerseyNumber !== null) {
      return a.jerseyNumber - b.jerseyNumber;
    }
    return a.name.localeCompare(b.name);
  });

  const players: PlayerOption[] = sortedPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    jersey_number: p.jerseyNumber
  }));

  return (
    <MatchesRoster
      matches={matches}
      players={players}
      createAction={
        <CreateMatchDrawer
          ageGroup={ageGroup}
          initialDate={initialDate}
          suggestedLineup={suggestedLineup}
          suggestedSubstitutes={suggestedSubstitutes}
        />
      }
    />
  );
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const { team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const initialDate = safeDate(resolvedSearchParams?.date);

  const playersData = await db.player.findMany({
    where: { workspaceId: team.id },
    select: {
      id: true,
      name: true,
      jerseyNumber: true
    },
    orderBy: [
      { jerseyNumber: "asc" },
      { name: "asc" }
    ]
  });

  const sortedPlayers = [...playersData].sort((a, b) => {
    if (a.jerseyNumber !== null && b.jerseyNumber === null) return -1;
    if (a.jerseyNumber === null && b.jerseyNumber !== null) return 1;
    if (a.jerseyNumber !== null && b.jerseyNumber !== null) {
      return a.jerseyNumber - b.jerseyNumber;
    }
    return a.name.localeCompare(b.name);
  });

  const suggestedLineup = sortedPlayers
    .slice(0, 11)
    .map((p) => (p.jerseyNumber ? `#${p.jerseyNumber} ${p.name}` : p.name))
    .join("\n");
  const suggestedSubstitutes = sortedPlayers
    .slice(11)
    .map((p) => (p.jerseyNumber ? `#${p.jerseyNumber} ${p.name}` : p.name))
    .join("\n");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
            Workspace
          </p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
            Spiele
          </h1>
          <p className="text-[14px] leading-6 text-muted-foreground">
            Plane Aufgebot, Formation, Ziele und Nachbesprechung. Filter und
            Suche helfen bei der Übersicht.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MatchImportDrawer />
          <CreateMatchDrawer
            ageGroup={team.ageGroup}
            initialDate={initialDate}
            suggestedLineup={suggestedLineup}
            suggestedSubstitutes={suggestedSubstitutes}
          />
        </div>
      </div>

      <Suspense fallback={<MatchesSkeleton />}>
        <MatchesData
          ageGroup={team.ageGroup}
          initialDate={initialDate}
          suggestedLineup={suggestedLineup}
          suggestedSubstitutes={suggestedSubstitutes}
          teamId={team.id}
        />
      </Suspense>
    </div>
  );
}

