import Link from "next/link";
import { Crown, Trash2, Trophy } from "lucide-react";
import {
  createPlayerAward,
  deletePlayerAward
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AwardsPage() {
  const { supabase, team } = await requireActiveTeam();
  const [playersResult, matchesResult, awardsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position,jersey_number")
      .eq("team_id", team.id)
      .order("last_name", { ascending: true }),
    supabase
      .from("matches")
      .select("id,date,opponent,result")
      .eq("team_id", team.id)
      .order("date", { ascending: false })
      .limit(30),
    supabase
      .from("player_awards")
      .select("*")
      .eq("team_id", team.id)
      .order("award_date", { ascending: false })
      .order("created_at", { ascending: false })
  ]);

  for (const result of [playersResult, matchesResult, awardsResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const players = playersResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const awards = awardsResult.data ?? [];
  const playerById = new Map(players.map((player) => [player.id, player]));
  const current = awards[0] ?? null;
  const counts = players
    .map((player) => ({
      player,
      count: awards.filter((award) => award.player_id === player.id).length
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Man of the Week / Hut-System mit aktuellem Gewinner, Übergabe und Hall of Fame."
        title="Hut-System"
      />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="h-fit border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Hut weitergeben</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPlayerAward} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="award-player">Neuer Gewinner</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  id="award-player"
                  name="player_id"
                  required
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="award-date">Datum</Label>
                  <Input id="award-date" name="award_date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="award-match">Spiel/Event</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="award-match"
                    name="match_id"
                  >
                    <option value="">Freies Event</option>
                    {matches.map((match) => (
                      <option key={match.id} value={match.id}>
                        {formatDate(match.date)} · {match.opponent}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                name="event_label"
                placeholder="Event falls kein Spiel ausgewählt"
              />
              <Textarea name="reason" placeholder="Begründung" required />
              <Button className="w-full" type="submit">
                <Crown aria-hidden="true" className="h-4 w-4" />
                Gewinner speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-slate-950 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-300">
                  Aktueller Man of the Week
                </p>
                <h2 className="mt-3 text-4xl font-semibold">
                  {current ? playerById.get(current.player_id)?.name : "Offen"}
                </h2>
                {current ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                    {current.reason ?? "Keine Begründung hinterlegt."}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">
                    Wähle nach dem nächsten positiven Spiel einen Gewinner.
                  </p>
                )}
              </div>
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/20">
                <Crown aria-hidden="true" className="h-12 w-12" />
              </div>
            </div>
            {current?.previous_player_id ? (
              <div className="mt-6 rounded-xl bg-white/10 p-4 text-sm">
                Vorheriger Gewinner:{" "}
                <span className="font-semibold">
                  {playerById.get(current.previous_player_id)?.name ?? "Unbekannt"}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Historie</CardTitle>
          </CardHeader>
          <CardContent>
            {awards.length > 0 ? (
              <div className="space-y-3">
                {awards.map((award) => {
                  const player = playerById.get(award.player_id);
                  const previous = award.previous_player_id
                    ? playerById.get(award.previous_player_id)
                    : null;
                  const match = award.match_id
                    ? matches.find((item) => item.id === award.match_id)
                    : null;

                  return (
                    <div
                      className="grid gap-3 rounded-xl border border-border bg-background/70 p-4 lg:grid-cols-[1fr_1.2fr_auto]"
                      key={award.id}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">
                            {player?.name ?? "Unbekannt"}
                          </p>
                          <Badge variant="success">{formatDate(award.award_date)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {match
                            ? `${match.opponent}${match.result ? ` · ${match.result}` : ""}`
                            : award.event_label ?? "Freies Event"}
                        </p>
                        {previous ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Übergabe von {previous.name}
                          </p>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {award.reason ?? "Keine Begründung."}
                      </p>
                      <form action={deletePlayerAward}>
                        <input name="id" type="hidden" value={award.id} />
                        <input
                          name="player_id"
                          type="hidden"
                          value={award.player_id}
                        />
                        <Button size="sm" type="submit" variant="ghost">
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Noch keine Auszeichnungen." />
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Hall of Fame</CardTitle>
          </CardHeader>
          <CardContent>
            {counts.length > 0 ? (
              <div className="space-y-3">
                {counts.map((item, index) => (
                  <Link
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-4 py-3 transition hover:bg-secondary"
                    href={`/players/${item.player.id}`}
                    key={item.player.id}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>
                        <span className="block font-semibold">
                          {item.player.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.player.position ?? "Position offen"}
                        </span>
                      </span>
                    </span>
                    <Badge variant="secondary">
                      <Trophy aria-hidden="true" className="mr-1 h-3 w-3" />
                      {item.count}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Hall of Fame startet mit der ersten Vergabe." />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
