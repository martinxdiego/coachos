import Link from "next/link";
import { Medal, Save, Trash2, Trophy } from "lucide-react";
import {
  deleteWinnerPoints,
  updateWinnerPoints
} from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import type { WinnerPointContextType } from "@/lib/types";
import { db } from "@/lib/db";

import { cacheGet, cacheSet } from "@/lib/redis";

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
  const { team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const period = resolvedSearchParams?.period ?? "season";
  const category = resolvedSearchParams?.category ?? "all";
  const type = resolvedSearchParams?.type ?? "all";

  const playersCacheKey = `leaderboard:${team.id}:players`;
  const pointsCacheKey = `leaderboard:${team.id}:points`;

  let cachedPlayers = await cacheGet<any[]>(playersCacheKey);
  let cachedPoints = await cacheGet<any[]>(pointsCacheKey);

  let dbPlayers: any[];
  let dbPoints: any[];

  if (cachedPlayers && cachedPoints) {
    dbPlayers = cachedPlayers;
    dbPoints = cachedPoints.map((pt) => ({
      ...pt,
      awardedAt: new Date(pt.awardedAt),
      date: new Date(pt.date),
      createdAt: new Date(pt.createdAt),
      updatedAt: new Date(pt.updatedAt)
    }));
  } else {
    const [freshPlayers, freshPoints] = await Promise.all([
      db.player.findMany({
        where: { workspaceId: team.id },
        select: {
          id: true,
          name: true,
          position: true,
          jerseyNumber: true,
        },
        orderBy: {
          lastName: "asc"
        }
      }),
      db.winnerPoint.findMany({
        where: { workspaceId: team.id },
        orderBy: { awardedAt: "desc" },
        take: 800
      })
    ]);

    dbPlayers = freshPlayers;
    dbPoints = freshPoints;

    await Promise.all([
      cacheSet(playersCacheKey, freshPlayers, 3600),
      cacheSet(pointsCacheKey, freshPoints, 3600)
    ]);
  }

  const players = dbPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    jersey_number: p.jerseyNumber,
    team_category: null
  }));

  const points = dbPoints.map((pt) => ({
    id: pt.id,
    player_id: pt.playerId,
    points: pt.points,
    reason: pt.reason,
    context_type: pt.contextType as WinnerPointContextType,
    context_label: pt.contextLabel,
    awarded_at: pt.awardedAt.toISOString().slice(0, 10)
  }));
  const categories = [
    ...new Set(players.map((player) => player.team_category).filter(Boolean))
  ] as unknown as string[];
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

      <Card>
        <CardHeader>
          <CardTitle>Letzte Punktevergaben bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          {points.length > 0 ? (
            <div className="grid gap-3">
              {points.slice(0, 12).map((point) => {
                const player = players.find((item) => item.id === point.player_id);

                return (
                  <details
                    className="rounded-xl border border-border bg-background/70 p-4"
                    key={point.id}
                  >
                    <summary className="cursor-pointer">
                      <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="font-semibold">
                            {player?.name ?? "Unbekannter Spieler"}
                          </span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {formatDate(point.awarded_at)} ·{" "}
                            {contextLabels[point.context_type]}
                          </span>
                        </span>
                        <Badge variant="success">+{point.points}</Badge>
                      </span>
                    </summary>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_auto]">
                      <form action={updateWinnerPoints} className="space-y-4">
                        <input name="id" type="hidden" value={point.id} />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Spieler</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={point.player_id}
                              name="player_id"
                            >
                              {players.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Punkte</Label>
                            <Input
                              defaultValue={point.points}
                              max={50}
                              min={1}
                              name="points"
                              type="number"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Datum</Label>
                            <Input
                              defaultValue={point.awarded_at}
                              name="awarded_at"
                              type="date"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Kontext</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={point.context_type}
                              name="context_type"
                            >
                              {Object.entries(contextLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>
                        <Input
                          defaultValue={point.context_label ?? ""}
                          name="context_label"
                          placeholder="Kontext / Event"
                        />
                        <Textarea
                          defaultValue={point.reason ?? ""}
                          name="reason"
                          placeholder="Begründung"
                        />
                        <Button type="submit">
                          <Save aria-hidden="true" className="h-4 w-4" />
                          Speichern
                        </Button>
                      </form>
                      <form action={deleteWinnerPoints}>
                        <input name="id" type="hidden" value={point.id} />
                        <input
                          name="player_id"
                          type="hidden"
                          value={point.player_id}
                        />
                        <Button
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          type="submit"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Löschen
                        </Button>
                      </form>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Noch keine Punktevergaben zum Bearbeiten." />
          )}
        </CardContent>
      </Card>

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
