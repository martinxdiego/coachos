import Link from "next/link";
import { Medal, Trophy } from "lucide-react";
import { WinnerPointsPanel } from "@/components/winner-points-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import type { WinnerPointContextType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface WinnerPointsPageProps {
  searchParams?: Promise<{
    period?: string;
    category?: string;
    type?: string;
  }>;
}

const contextLabels: Record<WinnerPointContextType, string> = {
  event: "Event",
  match: "Spiel",
  monday_training: "Montag",
  other: "Sonstiges",
  training: "Training"
};

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function periodStart(period: string) {
  const now = new Date();
  if (period === "week") {
    return startOfWeek(now);
  }

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
}

function isInPeriod(date: string, period: string) {
  const start = periodStart(period);
  if (!start) {
    return true;
  }

  return new Date(`${date}T00:00:00`).getTime() >= start.getTime();
}

export default async function WinnerPointsPage({
  searchParams
}: WinnerPointsPageProps) {
  const { supabase, team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const period = resolvedSearchParams?.period ?? "season";
  const category = resolvedSearchParams?.category ?? "all";
  const type = resolvedSearchParams?.type ?? "all";

  const [playersResult, pointsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position,jersey_number,team_category")
      .eq("team_id", team.id)
      .order("last_name", { ascending: true }),
    supabase
      .from("winner_points")
      .select("*")
      .eq("team_id", team.id)
      .order("awarded_at", { ascending: false })
      .limit(800)
  ]);

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  if (pointsResult.error) {
    throw new Error(pointsResult.error.message);
  }

  const players = playersResult.data ?? [];
  const points = pointsResult.data ?? [];
  const categories = [
    ...new Set(players.map((player) => player.team_category).filter(Boolean))
  ] as string[];
  const filteredPlayers =
    category === "all"
      ? players
      : players.filter((player) => player.team_category === category);
  const playerIds = new Set(filteredPlayers.map((player) => player.id));
  const filteredPoints = points.filter(
    (point) =>
      playerIds.has(point.player_id) &&
      isInPeriod(point.awarded_at, period) &&
      (type === "all" || point.context_type === type)
  );

  const leaderboard = filteredPlayers
    .map((player) => {
      const allForPlayer = points.filter((point) => point.player_id === player.id);
      const periodForPlayer = filteredPoints.filter(
        (point) => point.player_id === player.id
      );
      const breakdown = periodForPlayer.reduce<Record<string, number>>(
        (acc, point) => {
          acc[point.context_type] = (acc[point.context_type] ?? 0) + point.points;
          return acc;
        },
        {}
      );

      return {
        player,
        total: allForPlayer.reduce((sum, point) => sum + point.points, 0),
        periodTotal: periodForPlayer.reduce(
          (sum, point) => sum + point.points,
          0
        ),
        breakdown,
        lastPoint: allForPlayer[0] ?? null
      };
    })
    .sort((a, b) => b.periodTotal - a.periodTotal || b.total - a.total);

  const totalSeasonPoints = points.reduce((sum, point) => sum + point.points, 0);
  const leading = leaderboard[0];
  const filterHref = (next: Record<string, string>) => {
    const params = new URLSearchParams({
      period,
      category,
      type,
      ...next
    });
    return `/winnerpunkte?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Schnelle Punktevergabe waehrend Training, Spiel oder Event mit Saison-Leaderboard."
        title="Winnerpunkte"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-950 text-white">
          <CardContent className="p-5">
            <Medal aria-hidden="true" className="h-5 w-5 text-emerald-300" />
            <p className="mt-3 text-sm text-slate-300">Saisonpunkte</p>
            <p className="mt-1 text-3xl font-semibold">{totalSeasonPoints}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Trophy aria-hidden="true" className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Aktuell vorne</p>
            <p className="mt-1 text-2xl font-semibold">
              {leading?.player.name ?? "Offen"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Zeitraum</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["week", "Woche"],
                ["month", "Monat"],
                ["season", "Saison"]
              ].map(([value, label]) => (
                <Button
                  asChild
                  key={value}
                  size="sm"
                  variant={period === value ? "default" : "outline"}
                >
                  <Link href={filterHref({ period: value })}>{label}</Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <WinnerPointsPanel players={players} />

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle>Leaderboard</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  variant={type === "all" ? "default" : "outline"}
                >
                  <Link href={filterHref({ type: "all" })}>Alle Typen</Link>
                </Button>
                {Object.entries(contextLabels).map(([value, label]) => (
                  <Button
                    asChild
                    key={value}
                    size="sm"
                    variant={type === value ? "default" : "outline"}
                  >
                    <Link href={filterHref({ type: value })}>{label}</Link>
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((row, index) => (
                  <div
                    className="grid gap-3 rounded-xl border border-border bg-background/70 p-4 lg:grid-cols-[48px_1.2fr_0.8fr_1.2fr_1fr]"
                    key={row.player.id}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.player.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.player.position ?? "Position offen"}
                        {row.player.team_category
                          ? ` · ${row.player.team_category}`
                          : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gesamt</p>
                      <p className="text-2xl font-semibold">{row.total}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Zeitraum
                      </p>
                      <p className="text-2xl font-semibold">
                        {row.periodTotal}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(row.breakdown).length > 0 ? (
                          Object.entries(row.breakdown).map(
                            ([context, value]) => (
                              <Badge key={context} variant="secondary">
                                {contextLabels[context as WinnerPointContextType]}{" "}
                                {value}
                              </Badge>
                            )
                          )
                        ) : (
                          <Badge variant="outline">Keine Punkte</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Letzte Vergabe:{" "}
                        {row.lastPoint
                          ? `${formatDate(row.lastPoint.awarded_at)} · +${row.lastPoint.points}`
                          : "Noch nie"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Noch keine Spieler fuer das Leaderboard." />
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Team/Kategorie</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              variant={category === "all" ? "default" : "outline"}
            >
              <Link href={filterHref({ category: "all" })}>Alle</Link>
            </Button>
            {categories.map((item) => (
              <Button
                asChild
                key={item}
                size="sm"
                variant={category === item ? "default" : "outline"}
              >
                <Link href={filterHref({ category: item })}>{item}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
