import Link from "next/link";
import { CalendarPlus, Save, Trash2, Trophy } from "lucide-react";
import {
  createMatch,
  deleteMatch,
  importMatches,
  savePlayerEvaluation,
  updateMatch
} from "@/app/actions";
import { CreateMatchDrawer } from "@/components/create-match-drawer";
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
import { formatDate, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MatchesPageProps {
  searchParams?: Promise<{
    competition?: string;
    date?: string;
    from?: string;
    team?: string;
    to?: string;
  }>;
}

const formations: Record<string, number[]> = {
  "4-3-3": [1, 4, 3, 3],
  "4-2-3-1": [1, 4, 2, 3, 1],
  "3-5-2": [1, 3, 5, 2],
  "4-4-2": [1, 4, 4, 2],
  "3-4-3": [1, 3, 4, 3]
};

function splitNames(value: string | null) {
  return (
    value
      ?.split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function safeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIsoDate();
}

function FormationPreview({
  formation,
  players
}: {
  formation: string | null;
  players: string[];
}) {
  const lines = formations[formation ?? ""] ?? formations["4-3-3"];
  let index = 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-emerald-700 p-4 text-white shadow-inner">
      <div className="absolute inset-3 rounded-2xl border border-white/70" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
      <div className="relative grid min-h-[360px] grid-rows-5 gap-3">
        {lines.map((count, lineIndex) => (
          <div
            className="flex items-center justify-around gap-2"
            key={`${count}-${lineIndex}`}
          >
            {Array.from({ length: count }, () => {
              const name = players[index] ?? `${index + 1}`;
              index += 1;
              return (
                <div
                  className="flex h-11 min-w-11 items-center justify-center rounded-full border border-white/70 bg-slate-950/90 px-2 text-xs font-semibold shadow-lg"
                  key={`${name}-${index}`}
                >
                  {name.length > 9 ? name.slice(0, 8) : name}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchFields({
  initialDate,
  suggestedLineup,
  suggestedSubstitutes,
  match
}: {
  initialDate: string;
  suggestedLineup?: string;
  suggestedSubstitutes?: string;
  match?: {
    opponent: string;
    date: string;
    competition: string | null;
    team_category: string | null;
    kickoff_time: string | null;
    location: string | null;
    home_away: string | null;
    meeting_point: string | null;
    squad_notes: string | null;
    starting_lineup: string | null;
    substitutes: string | null;
    formation: string | null;
    tactical_instructions: string | null;
    match_goals: string | null;
    pre_match_notes: string | null;
    halftime_notes: string | null;
    post_match_notes: string | null;
    result: string | null;
    scorers: string | null;
    assists: string | null;
    cards: string | null;
    conclusion: string | null;
    notes: string | null;
  };
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Gegner</Label>
          <Input
            defaultValue={match?.opponent ?? ""}
            name="opponent"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Wettbewerb</Label>
          <Input
            defaultValue={match?.competition ?? ""}
            name="competition"
            placeholder="Meisterschaft, Cup"
          />
        </div>
        <div className="space-y-2">
          <Label>Kategorie</Label>
          <Input
            defaultValue={match?.team_category ?? ""}
            name="team_category"
            placeholder="U16, B-Junioren"
          />
        </div>
        <div className="space-y-2">
          <Label>Datum</Label>
          <Input
            defaultValue={match?.date ?? initialDate}
            name="date"
            required
            type="date"
          />
        </div>
        <div className="space-y-2">
          <Label>Uhrzeit</Label>
          <Input
            defaultValue={match?.kickoff_time ?? ""}
            name="kickoff_time"
            type="time"
          />
        </div>
        <div className="space-y-2">
          <Label>Heim/Auswärts</Label>
          <select
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={match?.home_away ?? "home"}
            name="home_away"
          >
            <option value="home">Heim</option>
            <option value="away">Auswärts</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          defaultValue={match?.location ?? ""}
          name="location"
          placeholder="Ort"
        />
        <Input
          defaultValue={match?.meeting_point ?? ""}
          name="meeting_point"
          placeholder="Treffpunkt"
        />
        <select
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue={match?.formation ?? "4-3-3"}
          name="formation"
        >
          {Object.keys(formations).map((formation) => (
            <option key={formation} value={formation}>
              {formation}
            </option>
          ))}
        </select>
        <Input
          defaultValue={match?.result ?? ""}
          name="result"
          placeholder="Resultat"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Startelf</Label>
          <Textarea
            defaultValue={match?.starting_lineup ?? suggestedLineup ?? ""}
            name="starting_lineup"
            placeholder="Ein Spieler pro Zeile"
          />
        </div>
        <div className="space-y-2">
          <Label>Ersatzspieler</Label>
          <Textarea
            defaultValue={match?.substitutes ?? suggestedSubstitutes ?? ""}
            name="substitutes"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Taktische Vorgaben</Label>
          <Textarea
            defaultValue={match?.tactical_instructions ?? ""}
            name="tactical_instructions"
          />
        </div>
        <div className="space-y-2">
          <Label>Matchziele</Label>
          <Textarea defaultValue={match?.match_goals ?? ""} name="match_goals" />
        </div>
        <div className="space-y-2">
          <Label>Aufgebot / Kadernotizen</Label>
          <Textarea defaultValue={match?.squad_notes ?? ""} name="squad_notes" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Vor dem Spiel</Label>
          <Textarea
            defaultValue={match?.pre_match_notes ?? ""}
            name="pre_match_notes"
          />
        </div>
        <div className="space-y-2">
          <Label>Halbzeit</Label>
          <Textarea
            defaultValue={match?.halftime_notes ?? ""}
            name="halftime_notes"
          />
        </div>
        <div className="space-y-2">
          <Label>Nach dem Spiel</Label>
          <Textarea
            defaultValue={match?.post_match_notes ?? ""}
            name="post_match_notes"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          defaultValue={match?.scorers ?? ""}
          name="scorers"
          placeholder="Torschützen"
        />
        <Input
          defaultValue={match?.assists ?? ""}
          name="assists"
          placeholder="Assists"
        />
        <Input
          defaultValue={match?.cards ?? ""}
          name="cards"
          placeholder="Karten"
        />
      </div>

      <Textarea
        defaultValue={match?.conclusion ?? ""}
        name="conclusion"
        placeholder="Fazit"
      />
      <Textarea
        defaultValue={match?.notes ?? ""}
        name="notes"
        placeholder="Weitere Notizen"
      />
    </div>
  );
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const { supabase, team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const initialDate = safeDate(resolvedSearchParams?.date);
  const teamFilter = resolvedSearchParams?.team ?? "all";
  const competitionFilter = resolvedSearchParams?.competition ?? "all";
  const fromFilter = resolvedSearchParams?.from ?? "";
  const toFilter = resolvedSearchParams?.to ?? "";
  const [matchesResult, playersResult] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("team_id", team.id)
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("players")
      .select("id,name,position,jersey_number")
      .eq("team_id", team.id)
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
  ]);

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  const matches = matchesResult.data ?? [];
  const players = playersResult.data ?? [];
  const teamCategories = [
    ...new Set(matches.map((match) => match.team_category).filter(Boolean))
  ] as string[];
  const competitions = [
    ...new Set(matches.map((match) => match.competition).filter(Boolean))
  ] as string[];
  const filteredMatches = matches.filter((match) => {
    if (teamFilter !== "all" && match.team_category !== teamFilter) {
      return false;
    }

    if (
      competitionFilter !== "all" &&
      match.competition !== competitionFilter
    ) {
      return false;
    }

    if (fromFilter && match.date < fromFilter) {
      return false;
    }

    if (toFilter && match.date > toFilter) {
      return false;
    }

    return true;
  });
  const suggestedLineup = players
    .slice(0, 11)
    .map((player) =>
      player.jersey_number ? `#${player.jersey_number} ${player.name}` : player.name
    )
    .join("\n");
  const suggestedSubstitutes = players
    .slice(11)
    .map((player) =>
      player.jersey_number ? `#${player.jersey_number} ${player.name}` : player.name
    )
    .join("\n");

  return (
    <div className="space-y-6">
      <PageHeader
        description="Plane Aufgebot, Formation, Ziele und Nachbesprechung."
        title="Spiele"
      />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <aside className="space-y-4">
          <CreateMatchDrawer
            ageGroup={team.age_group}
            initialDate={initialDate}
            suggestedLineup={suggestedLineup}
            suggestedSubstitutes={suggestedSubstitutes}
          />
          <Card>
            <CardHeader>
              <CardTitle>Spiele importieren</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={importMatches} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="matches-file">CSV/TXT-Datei optional</Label>
                  <Input
                    accept=".csv,.txt"
                    id="matches-file"
                    name="matches_file"
                    type="file"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matches-csv">Oder Liste einfügen</Label>
                  <Textarea
                    id="matches-csv"
                    name="matches_csv"
                    placeholder={
                      "Datum;Gegner;Anspielzeit;Ort;home/away/neutral;Wettbewerb;Resultat;Kategorie\n2026-05-09;FC Beispiel;10:00;Gersag;home;Meisterschaft;;U16"
                    }
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Excel als CSV exportieren. PDF-Import kann später über einen
                  spezialisierten Parser ergänzt werden.
                </p>
                <Button className="w-full" type="submit" variant="secondary">
                  Spiele importieren
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spiele filtern</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" method="get">
                <div className="space-y-2">
                  <Label htmlFor="match-filter-team">Team/Kategorie</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue={teamFilter}
                    id="match-filter-team"
                    name="team"
                  >
                    <option value="all">Alle Kategorien</option>
                    {teamCategories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="match-filter-competition">Wettbewerb</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue={competitionFilter}
                    id="match-filter-competition"
                    name="competition"
                  >
                    <option value="all">Alle Wettbewerbe</option>
                    {competitions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="match-filter-from">Von</Label>
                    <Input
                      defaultValue={fromFilter}
                      id="match-filter-from"
                      name="from"
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="match-filter-to">Bis</Label>
                    <Input
                      defaultValue={toFilter}
                      id="match-filter-to"
                      name="to"
                      type="date"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">Filter anwenden</Button>
                  <Button asChild variant="outline">
                    <Link href="/matches">Zurücksetzen</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredMatches.length} von {matches.length} Spielen sichtbar
                </p>
              </form>
            </CardContent>
          </Card>
        </aside>
        <Card className="hidden h-fit border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Spiel planen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createMatch} className="space-y-4">
              <MatchFields
                initialDate={initialDate}
                suggestedLineup={suggestedLineup}
                suggestedSubstitutes={suggestedSubstitutes}
              />
              <Button className="w-full" type="submit">
                <CalendarPlus aria-hidden="true" className="h-4 w-4" />
                Spiel speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredMatches.length > 0 ? (
            filteredMatches.map((match) => {
              const lineup = splitNames(match.starting_lineup);
              return (
                <Card className="overflow-hidden" key={match.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle>{match.opponent}</CardTitle>
                          {match.home_away ? (
                            <Badge variant="secondary">{match.home_away}</Badge>
                          ) : null}
                          {match.result ? (
                            <Badge variant="success">{match.result}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatDate(match.date)}
                          {match.kickoff_time
                            ? ` · ${match.kickoff_time.slice(0, 5)}`
                            : ""}
                          {match.location ? ` · ${match.location}` : ""}
                        </p>
                      </div>
                      <Trophy aria-hidden="true" className="h-6 w-6 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-5 xl:grid-cols-[360px_1fr]">
                    <FormationPreview
                      formation={match.formation}
                      players={lineup}
                    />

                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-secondary px-3 py-3">
                          <p className="text-xs text-muted-foreground">
                            Formation
                          </p>
                          <p className="font-semibold">
                            {match.formation ?? "4-3-3"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-secondary px-3 py-3">
                          <p className="text-xs text-muted-foreground">
                            Startelf
                          </p>
                          <p className="font-semibold">{lineup.length}</p>
                        </div>
                        <div className="rounded-xl bg-secondary px-3 py-3">
                          <p className="text-xs text-muted-foreground">
                            Treffpunkt
                          </p>
                          <p className="font-semibold">
                            {match.meeting_point ?? "Offen"}
                          </p>
                        </div>
                      </div>

                      {match.match_goals ? (
                        <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                          {match.match_goals}
                        </p>
                      ) : null}

                      <div className="rounded-xl border border-slate-900/10 bg-slate-950 p-4 text-white">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                              Matchday
                            </p>
                            <p className="mt-1 font-semibold">
                              {match.formation ?? "4-3-3"} gegen {match.opponent}
                            </p>
                          </div>
                          <Trophy aria-hidden="true" className="h-5 w-5 text-emerald-300" />
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg bg-white/10 p-3">
                            <p className="text-xs text-slate-300">Treffpunkt</p>
                            <p className="mt-1 text-sm font-medium">
                              {match.meeting_point ?? "Noch offen"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/10 p-3">
                            <p className="text-xs text-slate-300">Aufgebot</p>
                            <p className="mt-1 text-sm font-medium">
                              {lineup.length} Startelf ·{" "}
                              {splitNames(match.substitutes).length} Ersatz
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {[
                            "Spielidee im Staff geklärt",
                            "Startelf und Bank kommuniziert",
                            "Halbzeitnotiz nachtragen",
                            "Fazit direkt nach dem Spiel speichern"
                          ].map((item) => (
                            <label
                              className="flex items-center justify-between gap-3 rounded-lg bg-white/8 px-3 py-2 text-sm"
                              key={item}
                            >
                              <span>{item}</span>
                              <input className="h-4 w-4" type="checkbox" />
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button asChild variant="outline">
                          <Link href={`/analysis?match=${match.id}`}>
                            Vorbereitung / Analyse
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href={`/winnerpunkte?type=match`}>
                            Winnerpunkte
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link href="/evaluations">Bewertungen</Link>
                        </Button>
                      </div>

                      <details className="rounded-xl border border-border p-4">
                        <summary className="cursor-pointer text-sm font-semibold">
                          Spielerbewertung für dieses Spiel
                        </summary>
                        <form
                          action={savePlayerEvaluation}
                          className="mt-4 grid gap-3 md:grid-cols-6"
                        >
                          <input name="context_type" type="hidden" value="match" />
                          <input name="context_id" type="hidden" value={match.id} />
                          <input
                            name="context_label"
                            type="hidden"
                            value={match.opponent}
                          />
                          <input
                            name="evaluation_date"
                            type="hidden"
                            value={match.date}
                          />
                          <select
                            className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-span-2"
                            name="player_id"
                          >
                            {players.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.name}
                              </option>
                            ))}
                          </select>
                          {[
                            ["match_quality", "Spiel"],
                            ["effort", "Einsatz"],
                            ["behavior", "Verhalten"],
                            ["concentration", "Fokus"]
                          ].map(([name, label]) => (
                            <select
                              aria-label={label}
                              className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue="3"
                              key={name}
                              name={name}
                            >
                              {[1, 2, 3, 4, 5].map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          ))}
                          <Textarea
                            className="md:col-span-5"
                            name="notes"
                            placeholder="Kurzfeedback"
                          />
                          <Button className="md:col-span-1" type="submit">
                            Speichern
                          </Button>
                        </form>
                      </details>

                      <details className="rounded-xl border border-border p-4">
                        <summary className="cursor-pointer text-sm font-semibold">
                          Spiel bearbeiten
                        </summary>
                        <form action={updateMatch} className="mt-4 space-y-4">
                          <input name="id" type="hidden" value={match.id} />
                          <MatchFields
                            initialDate={initialDate}
                            match={match}
                            suggestedLineup={suggestedLineup}
                            suggestedSubstitutes={suggestedSubstitutes}
                          />
                          <Button type="submit">
                            <Save aria-hidden="true" className="h-4 w-4" />
                            Spiel speichern
                          </Button>
                        </form>
                      </details>

                      <form action={deleteMatch}>
                        <input name="id" type="hidden" value={match.id} />
                        <Button size="sm" type="submit" variant="ghost">
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Spiel löschen
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <EmptyState
              body={
                matches.length > 0
                  ? "Passe die Filter links an oder setze sie zurück."
                  : "Erfasse Gegner, Datum, Formation und Matchziele. Die visuelle Aufstellung entsteht aus der Startelf."
              }
              title={
                matches.length > 0
                  ? "Keine Spiele für diese Filter."
                  : "Noch keine Spiele geplant."
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
