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
import { requireActiveTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

async function MatchesData({ teamId }: { teamId: string }) {
  const supabase = await createClient();

  const [matchesResult, playersResult] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("team_id", teamId)
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("players")
      .select("id,name,position,jersey_number")
      .eq("team_id", teamId)
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
  ]);

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }
  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  const matches = (matchesResult.data ?? []) as MatchRow[];
  const players = (playersResult.data ?? []) as PlayerOption[];

  return <MatchesRoster matches={matches} players={players} />;
}

async function MatchesActions({ initialDate }: { initialDate: string }) {
  const { team } = await requireActiveTeam();
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("players")
    .select("id,name,jersey_number")
    .eq("team_id", team.id)
    .order("jersey_number", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  const suggestedLineup = (players ?? [])
    .slice(0, 11)
    .map((player) =>
      player.jersey_number
        ? `#${player.jersey_number} ${player.name}`
        : player.name
    )
    .join("\n");
  const suggestedSubstitutes = (players ?? [])
    .slice(11)
    .map((player) =>
      player.jersey_number
        ? `#${player.jersey_number} ${player.name}`
        : player.name
    )
    .join("\n");

  return (
    <div className="flex flex-wrap gap-2">
      <MatchImportDrawer />
      <CreateMatchDrawer
        ageGroup={team.age_group}
        initialDate={initialDate}
        suggestedLineup={suggestedLineup}
        suggestedSubstitutes={suggestedSubstitutes}
      />
    </div>
  );
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const { team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const initialDate = safeDate(resolvedSearchParams?.date);

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
        <Suspense fallback={null}>
          <MatchesActions initialDate={initialDate} />
        </Suspense>
      </div>

      <Suspense fallback={<MatchesSkeleton />}>
        <MatchesData teamId={team.id} />
      </Suspense>
    </div>
  );
}
