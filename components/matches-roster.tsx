"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  Pencil,
  Save,
  Search,
  Trash2,
  Trophy,
  X
} from "lucide-react";
import {
  deleteMatch,
  savePlayerEvaluation,
  updateMatch
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { ToastForm } from "@/components/toast-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate, todayIsoDate } from "@/lib/utils";

const FORMATIONS: Record<string, number[]> = {
  "4-3-3": [1, 4, 3, 3],
  "4-2-3-1": [1, 4, 2, 3, 1],
  "3-5-2": [1, 3, 5, 2],
  "4-4-2": [1, 4, 4, 2],
  "3-4-3": [1, 3, 4, 3]
};

const formationKeys = Object.keys(FORMATIONS);

export interface MatchRow {
  id: string;
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
}

export interface PlayerOption {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
}

type StatusFilter = "all" | "upcoming" | "past";
type SortKey = "newest" | "upcoming" | "oldest";

function splitNames(value: string | null) {
  return (
    value
      ?.split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function FormationPreview({
  formation,
  players
}: {
  formation: string | null;
  players: string[];
}) {
  const lines = FORMATIONS[formation ?? ""] ?? FORMATIONS["4-3-3"];
  let index = 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 p-4 text-white shadow-soft">
      <div
        aria-hidden="true"
        className="absolute inset-3 rounded-2xl border border-white/40"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30"
      />
      <div className="relative grid min-h-[320px] grid-rows-5 gap-3">
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
                  className="flex h-10 min-w-10 items-center justify-center rounded-full border border-white/60 bg-slate-950/85 px-2 text-[11px] font-semibold tracking-tight shadow-sm"
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

function StatTile({
  label,
  value
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function MatchEditFields({ match }: { match: MatchRow }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Gegner</Label>
          <Input defaultValue={match.opponent} name="opponent" required />
        </div>
        <div className="space-y-2">
          <Label>Wettbewerb</Label>
          <Input
            defaultValue={match.competition ?? ""}
            name="competition"
            placeholder="Meisterschaft"
          />
        </div>
        <div className="space-y-2">
          <Label>Kategorie</Label>
          <Input
            defaultValue={match.team_category ?? ""}
            name="team_category"
          />
        </div>
        <div className="space-y-2">
          <Label>Datum</Label>
          <Input
            defaultValue={match.date}
            name="date"
            required
            type="date"
          />
        </div>
        <div className="space-y-2">
          <Label>Uhrzeit</Label>
          <Input
            defaultValue={match.kickoff_time ?? ""}
            name="kickoff_time"
            type="time"
          />
        </div>
        <div className="space-y-2">
          <Label>Heim/Auswärts</Label>
          <select
            className="flex h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-sm focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
            defaultValue={match.home_away ?? "home"}
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
          defaultValue={match.location ?? ""}
          name="location"
          placeholder="Ort"
        />
        <Input
          defaultValue={match.meeting_point ?? ""}
          name="meeting_point"
          placeholder="Treffpunkt"
        />
        <select
          className="flex h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-sm focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
          defaultValue={match.formation ?? "4-3-3"}
          name="formation"
        >
          {formationKeys.map((formation) => (
            <option key={formation} value={formation}>
              {formation}
            </option>
          ))}
        </select>
        <Input
          defaultValue={match.result ?? ""}
          name="result"
          placeholder="Resultat"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Startelf</Label>
          <Textarea
            defaultValue={match.starting_lineup ?? ""}
            name="starting_lineup"
            placeholder="Ein Spieler pro Zeile"
          />
        </div>
        <div className="space-y-2">
          <Label>Ersatzspieler</Label>
          <Textarea
            defaultValue={match.substitutes ?? ""}
            name="substitutes"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Taktische Vorgaben</Label>
          <Textarea
            defaultValue={match.tactical_instructions ?? ""}
            name="tactical_instructions"
          />
        </div>
        <div className="space-y-2">
          <Label>Matchziele</Label>
          <Textarea
            defaultValue={match.match_goals ?? ""}
            name="match_goals"
          />
        </div>
        <div className="space-y-2">
          <Label>Aufgebot / Kadernotizen</Label>
          <Textarea
            defaultValue={match.squad_notes ?? ""}
            name="squad_notes"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Vor dem Spiel</Label>
          <Textarea
            defaultValue={match.pre_match_notes ?? ""}
            name="pre_match_notes"
          />
        </div>
        <div className="space-y-2">
          <Label>Halbzeit</Label>
          <Textarea
            defaultValue={match.halftime_notes ?? ""}
            name="halftime_notes"
          />
        </div>
        <div className="space-y-2">
          <Label>Nach dem Spiel</Label>
          <Textarea
            defaultValue={match.post_match_notes ?? ""}
            name="post_match_notes"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          defaultValue={match.scorers ?? ""}
          name="scorers"
          placeholder="Torschützen"
        />
        <Input
          defaultValue={match.assists ?? ""}
          name="assists"
          placeholder="Assists"
        />
        <Input
          defaultValue={match.cards ?? ""}
          name="cards"
          placeholder="Karten"
        />
      </div>

      <Textarea
        defaultValue={match.conclusion ?? ""}
        name="conclusion"
        placeholder="Fazit"
      />
      <Textarea
        defaultValue={match.notes ?? ""}
        name="notes"
        placeholder="Weitere Notizen"
      />
    </div>
  );
}

function MatchCard({
  match,
  players
}: {
  match: MatchRow;
  players: PlayerOption[];
}) {
  const lineup = splitNames(match.starting_lineup);
  const subs = splitNames(match.substitutes);
  const isUpcoming = match.date >= todayIsoDate();
  const homeAwayLabel =
    match.home_away === "home"
      ? "Heim"
      : match.home_away === "away"
      ? "Auswärts"
      : match.home_away === "neutral"
      ? "Neutral"
      : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-5 p-6 xl:grid-cols-[320px_1fr]">
        <FormationPreview formation={match.formation} players={lineup} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[20px] font-semibold tracking-tight">
                  {match.opponent}
                </h2>
                {homeAwayLabel ? (
                  <Badge variant="secondary">{homeAwayLabel}</Badge>
                ) : null}
                {match.result ? (
                  <Badge variant="success">{match.result}</Badge>
                ) : isUpcoming ? (
                  <Badge variant="outline">Bevorstehend</Badge>
                ) : null}
                {match.competition ? (
                  <Badge variant="outline">{match.competition}</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {formatDate(match.date)}
                {match.kickoff_time
                  ? ` · ${match.kickoff_time.slice(0, 5)}`
                  : ""}
                {match.location ? ` · ${match.location}` : ""}
              </p>
            </div>
            <Trophy
              aria-hidden="true"
              className="h-6 w-6 shrink-0 text-primary opacity-80"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Formation
              </p>
              <p className="mt-0.5 text-[14px] font-semibold tracking-tight">
                {match.formation ?? "4-3-3"}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Aufgebot
              </p>
              <p className="mt-0.5 text-[14px] font-semibold tracking-tight">
                {lineup.length} · {subs.length} Bank
              </p>
            </div>
            <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Treffpunkt
              </p>
              <p className="mt-0.5 truncate text-[14px] font-semibold tracking-tight">
                {match.meeting_point ?? "—"}
              </p>
            </div>
          </div>

          {match.match_goals ? (
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-4 text-[13px] leading-6 text-emerald-900">
              {match.match_goals}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/analysis?match=${match.id}`}>
                Vorbereitung / Analyse
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/winnerpunkte?type=match">Winnerpunkte</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/evaluations">Bewertungen</Link>
            </Button>
          </div>

          {players.length > 0 ? (
            <details className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
              <summary className="flex cursor-pointer items-center justify-between text-[14px] font-semibold tracking-tight">
                Spielerbewertung erfassen
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <ToastForm
                action={savePlayerEvaluation}
                className="mt-4 grid gap-3 md:grid-cols-6"
                successMessage="Bewertung gespeichert"
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
                  className="md:col-span-2 flex h-11 rounded-xl border border-input bg-card px-3.5 text-[14px] text-foreground shadow-sm focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
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
                    className="flex h-11 rounded-xl border border-input bg-card px-3.5 text-[14px] text-foreground shadow-sm focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
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
              </ToastForm>
            </details>
          ) : null}

          <details className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
            <summary className="flex cursor-pointer items-center justify-between text-[14px] font-semibold tracking-tight">
              <span className="flex items-center gap-2">
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Spiel bearbeiten
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground"
              />
            </summary>
            <ToastForm
              action={updateMatch}
              className="mt-4 space-y-4"
              successMessage="Spiel aktualisiert"
            >
              <input name="id" type="hidden" value={match.id} />
              <MatchEditFields match={match} />
              <Button type="submit">
                <Save aria-hidden="true" className="h-4 w-4" />
                Spiel speichern
              </Button>
            </ToastForm>
          </details>

          <div className="flex justify-end">
            <ToastForm
              action={deleteMatch}
              successMessage="Spiel gelöscht"
              errorMessage="Spiel konnte nicht gelöscht werden."
            >
              <input name="id" type="hidden" value={match.id} />
              <Button
                className="text-muted-foreground hover:text-destructive"
                size="sm"
                type="submit"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Spiel löschen
              </Button>
            </ToastForm>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MatchesRosterProps {
  matches: MatchRow[];
  players: PlayerOption[];
}

export function MatchesRoster({ matches, players }: MatchesRosterProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const competitions = useMemo(
    () =>
      Array.from(
        new Set(
          matches
            .map((m) => m.competition)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [matches]
  );
  const teamCategories = useMemo(
    () =>
      Array.from(
        new Set(
          matches
            .map((m) => m.team_category)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [matches]
  );

  const today = todayIsoDate();
  const stats = useMemo(() => {
    const upcoming = matches.filter((m) => m.date >= today).length;
    const withResult = matches.filter((m) => m.result?.trim()).length;
    return {
      total: matches.length,
      upcoming,
      played: matches.length - upcoming,
      withResult
    };
  }, [matches, today]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return matches
      .filter((match) => {
        if (statusFilter === "upcoming" && match.date < today) return false;
        if (statusFilter === "past" && match.date >= today) return false;
        if (
          competitionFilter !== "all" &&
          match.competition !== competitionFilter
        )
          return false;
        if (teamFilter !== "all" && match.team_category !== teamFilter)
          return false;
        if (!term) return true;
        const haystack = [
          match.opponent,
          match.competition,
          match.team_category,
          match.location,
          match.result
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        if (sortKey === "newest") return b.date.localeCompare(a.date);
        if (sortKey === "oldest") return a.date.localeCompare(b.date);
        // upcoming first: future ascending, past descending
        const aFuture = a.date >= today;
        const bFuture = b.date >= today;
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;
        if (aFuture) return a.date.localeCompare(b.date);
        return b.date.localeCompare(a.date);
      });
  }, [matches, search, statusFilter, competitionFilter, teamFilter, sortKey, today]);

  const statusChips: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "Alle", count: stats.total },
    { id: "upcoming", label: "Bevorstehend", count: stats.upcoming },
    { id: "past", label: "Vergangen", count: stats.played }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatTile label="Gesamt" value={stats.total} />
        <StatTile label="Bevorstehend" value={stats.upcoming} />
        <StatTile label="Mit Resultat" value={stats.withResult} />
        <StatTile label="Vergangen" value={stats.played} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-10"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Gegner, Wettbewerb, Ort…"
            type="search"
            value={search}
          />
          {search ? (
            <button
              aria-label="Suche leeren"
              className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setSearch("")}
              type="button"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusChips.map((chip) => {
            const isActive = chip.id === statusFilter;
            return (
              <button
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium tracking-tight transition-colors duration-150 active:scale-95",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground/80 hover:border-foreground/40"
                )}
                key={chip.id}
                onClick={() => setStatusFilter(chip.id)}
                type="button"
              >
                {chip.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px]",
                    isActive
                      ? "bg-background/20 text-background"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}

          {competitions.length > 0 ? (
            <div className="relative">
              <select
                aria-label="Wettbewerb"
                className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-card pl-3.5 pr-9 text-[13px] font-medium tracking-tight text-foreground/80 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(e) => setCompetitionFilter(e.target.value)}
                value={competitionFilter}
              >
                <option value="all">Alle Wettbewerbe</option>
                {competitions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronsUpDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          ) : null}

          {teamCategories.length > 0 ? (
            <div className="relative">
              <select
                aria-label="Team / Kategorie"
                className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-card pl-3.5 pr-9 text-[13px] font-medium tracking-tight text-foreground/80 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(e) => setTeamFilter(e.target.value)}
                value={teamFilter}
              >
                <option value="all">Alle Teams</option>
                {teamCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronsUpDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
            </div>
          ) : null}

          <div className="relative">
            <select
              aria-label="Sortierung"
              className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-card pl-3.5 pr-9 text-[13px] font-medium tracking-tight text-foreground/80 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              value={sortKey}
            >
              <option value="newest">Neueste zuerst</option>
              <option value="upcoming">Bevorstehend zuerst</option>
              <option value="oldest">Älteste zuerst</option>
            </select>
            <ChevronsUpDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          body={
            matches.length === 0
              ? "Plane das erste Spiel oder importiere mehrere via CSV."
              : "Passe Filter oder Suche an. Reset über 'Alle'."
          }
          title={
            matches.length === 0
              ? "Noch keine Spiele geplant."
              : "Keine Treffer."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((match) => (
            <MatchCard key={match.id} match={match} players={players} />
          ))}
        </div>
      )}
    </div>
  );
}
