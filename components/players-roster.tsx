"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronsUpDown,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { createPlayer, deletePlayer, importPlayers } from "@/app/actions";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { EmptyState } from "@/components/empty-state";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
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
import { cn } from "@/lib/utils";

type PlayerStatus = "available" | "limited" | "injured" | "absent";

export interface PlayerRow {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  birth_year: number | null;
  team_category: string | null;
  jersey_number: number | null;
  status: PlayerStatus;
  rating: number | null;
  development_goals: string | null;
  photo_url: string | null;
}

type StatusFilter = "all" | PlayerStatus;
type SortKey = "lastName" | "jerseyNumber" | "birthYear";

const statusLabels: Record<PlayerStatus, string> = {
  available: "Fit",
  limited: "Aufbau",
  injured: "Verletzt",
  absent: "Abwesend"
};

const statusBadgeVariant: Record<
  PlayerStatus,
  "success" | "secondary" | "destructive" | "outline"
> = {
  available: "success",
  limited: "secondary",
  injured: "destructive",
  absent: "outline"
};

function StatusBadge({ status }: { status: PlayerStatus }) {
  return (
    <Badge variant={statusBadgeVariant[status]}>{statusLabels[status]}</Badge>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatTile({ label, value }: { label: string; value: number }) {
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

interface PlayersRosterProps {
  players: PlayerRow[];
}

export function PlayersRoster({ players }: PlayersRosterProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastName");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const stats = useMemo(() => {
    return {
      total: players.length,
      available: players.filter((p) => p.status === "available").length,
      limited: players.filter((p) => p.status === "limited").length,
      injured: players.filter((p) => p.status === "injured").length
    };
  }, [players]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players
      .filter((player) => {
        if (statusFilter !== "all" && player.status !== statusFilter)
          return false;
        if (!term) return true;
        const haystack = [
          player.name,
          player.first_name,
          player.last_name,
          player.position,
          player.jersey_number?.toString(),
          player.team_category
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        if (sortKey === "lastName") {
          return (a.last_name ?? a.name).localeCompare(b.last_name ?? b.name);
        }
        if (sortKey === "jerseyNumber") {
          const an = a.jersey_number ?? 999;
          const bn = b.jersey_number ?? 999;
          return an - bn;
        }
        const ay = a.birth_year ?? 0;
        const by = b.birth_year ?? 0;
        return by - ay;
      });
  }, [players, search, statusFilter, sortKey]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, PlayerRow[]>>((acc, player) => {
      const key = player.position ?? "Ohne Position";
      acc[key] = [...(acc[key] ?? []), player];
      return acc;
    }, {});
  }, [filtered]);

  const filterChips: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "Alle", count: stats.total },
    { id: "available", label: "Fit", count: stats.available },
    { id: "limited", label: "Aufbau", count: stats.limited },
    { id: "injured", label: "Verletzt", count: stats.injured }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
            Workspace
          </p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
            Kader
          </h1>
          <p className="text-[14px] leading-6 text-muted-foreground">
            Schnell erfassen, später detailliert entwickeln. Filter und Suche
            helfen bei der Übersicht.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setImportOpen(true)}
            type="button"
            variant="outline"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            Importieren
          </Button>
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Spieler hinzufügen
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatTile label="Gesamt" value={stats.total} />
        <StatTile label="Fit" value={stats.available} />
        <StatTile label="Aufbau" value={stats.limited} />
        <StatTile label="Verletzt" value={stats.injured} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-10"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Spieler suchen…"
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => {
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

          <div className="relative">
            <select
              aria-label="Sortierung"
              className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-card pl-3.5 pr-9 text-[13px] font-medium tracking-tight text-foreground/80 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              value={sortKey}
            >
              <option value="lastName">Nach Name</option>
              <option value="jerseyNumber">Nach Nummer</option>
              <option value="birthYear">Nach Jahrgang</option>
            </select>
            <ChevronsUpDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Roster */}
      {filtered.length === 0 ? (
        <EmptyState
          body={
            players.length === 0
              ? "Erstelle den ersten Spieler oder importiere deinen Kader per CSV."
              : "Keine Spieler entsprechen Suche oder Filter. Filter zurücksetzen oder anders suchen."
          }
          title={
            players.length === 0
              ? "Noch keine Spieler im Workspace."
              : "Keine Treffer."
          }
          action={
            players.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCreateOpen(true)} type="button">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Spieler hinzufügen
                </Button>
                <Button
                  onClick={() => setImportOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <Upload aria-hidden="true" className="h-4 w-4" />
                  Kader importieren
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setStatusFilter("all")}
                type="button"
                variant="outline"
              >
                Filter zurücksetzen
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([position, items]) => (
            <Card key={position}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{position}</CardTitle>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SideDrawer
        eyebrow="Kader"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Spieler hinzufügen"
        description="Vorname, Nachname und Position reichen für den Anfang. Details folgen im Profil."
      >
        <ToastForm
          action={createPlayer}
          className="space-y-4"
          onComplete={() => setCreateOpen(false)}
          successMessage="Spieler hinzugefügt"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cp-first-name">Vorname</Label>
              <Input
                autoFocus
                id="cp-first-name"
                name="first_name"
                placeholder="Luca"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-last-name">Nachname</Label>
              <Input
                id="cp-last-name"
                name="last_name"
                placeholder="Meier"
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cp-position">Position</Label>
              <Input id="cp-position" name="position" placeholder="ZM" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-jersey">Rückennummer</Label>
              <Input
                id="cp-jersey"
                name="jersey_number"
                placeholder="8"
                type="number"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["available", "Fit", "border-emerald-200 bg-emerald-50 text-emerald-900 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-100"],
                  ["limited", "Aufbau", "border-amber-200 bg-amber-50 text-amber-900 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-100"],
                  ["injured", "Verletzt", "border-red-200 bg-red-50 text-red-900 has-[:checked]:border-red-400 has-[:checked]:bg-red-100"],
                  ["absent", "Abwesend", "border-border bg-secondary text-foreground has-[:checked]:border-foreground has-[:checked]:bg-foreground/10"]
                ] as const
              ).map(([value, label, classes], idx) => (
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium tracking-tight transition-colors",
                    classes
                  )}
                  key={value}
                >
                  <input
                    className="sr-only"
                    defaultChecked={idx === 0}
                    name="status"
                    type="radio"
                    value={value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <details className="rounded-xl border border-border/70 bg-secondary/30 p-3 text-[13px]">
            <summary className="cursor-pointer font-medium tracking-tight">
              Optionale Felder
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cp-birth-year">Jahrgang</Label>
                <Input
                  id="cp-birth-year"
                  name="birth_year"
                  placeholder="2010"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-strong-foot">Bevorzugter Fuss</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue=""
                  id="cp-strong-foot"
                  name="strong_foot"
                >
                  <option value="">Offen</option>
                  <option value="left">Links</option>
                  <option value="right">Rechts</option>
                  <option value="both">Beidfüssig</option>
                </select>
              </div>
            </div>
          </details>
          <Button className="w-full" type="submit">
            Spieler speichern
          </Button>
        </ToastForm>
      </SideDrawer>

      <SideDrawer
        eyebrow="Kader"
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Kader importieren"
        description="Eine Zeile pro Spieler. Trennzeichen werden automatisch erkannt. Eine Kopfzeile ist optional."
      >
        <ToastForm
          action={importPlayers}
          className="space-y-4"
          onComplete={() => setImportOpen(false)}
          successMessage="Kader importiert"
        >
          <div className="space-y-2">
            <Label htmlFor="ip-csv">Liste einfügen</Label>
            <Textarea
              className="min-h-44 font-mono text-[13px]"
              id="ip-csv"
              name="players_csv"
              placeholder={
                "Vorname;Nachname;Position;Jahrgang;Nummer\nLuca;Meier;ZM;2010;8"
              }
              required
            />
            <p className="text-[12px] leading-5 text-muted-foreground">
              Unterstützt Semikolon, Komma oder Tab.
            </p>
          </div>
          <Button className="w-full" type="submit">
            Kader importieren
          </Button>
        </ToastForm>
      </SideDrawer>
    </div>
  );
}

function PlayerCard({ player }: { player: PlayerRow }) {
  const profileFields = [
    player.birth_year,
    player.photo_url,
    player.development_goals,
    player.team_category,
    player.jersey_number
  ];
  const filled = profileFields.filter(Boolean).length;
  const profileComplete = Math.round((filled / profileFields.length) * 100);

  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-4 transition-[transform,box-shadow,border-color] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar player={player} />
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">
              {player.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge status={player.status} />
              {player.rating ? (
                <Badge variant="secondary">{player.rating}/10</Badge>
              ) : null}
              {player.team_category ? (
                <Badge variant="outline">{player.team_category}</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <Button
          asChild
          aria-label="Profil öffnen"
          size="icon"
          variant="ghost"
        >
          <Link href={`/players/${player.id}`}>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Jahrgang
          </p>
          <p className="font-medium tracking-tight">
            {player.birth_year ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Nummer
          </p>
          <p className="font-medium tracking-tight">
            {player.jersey_number ?? "—"}
          </p>
        </div>
      </div>

      {player.development_goals ? (
        <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-muted-foreground">
          {player.development_goals}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <span>Profil {profileComplete}%</span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 bg-primary/70 transition-[width] duration-500 ease-spring"
            style={{ width: `${profileComplete}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/player-mode?player=${player.id}`}>Spieler-Modus</Link>
        </Button>
        <ConfirmDeleteForm
          action={deletePlayer}
          confirm={{
            title: "Spieler entfernen?",
            description: `${player.name} wird aus dem Kader entfernt. Bewertungen, Anwesenheiten und verknüpfte Daten gehen verloren.`
          }}
          successMessage="Spieler entfernt"
          errorMessage="Spieler konnte nicht entfernt werden."
        >
          <input name="id" type="hidden" value={player.id} />
          <Button
            aria-label={`${player.name} entfernen`}
            className="text-muted-foreground hover:text-destructive"
            size="icon"
            type="submit"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </Button>
        </ConfirmDeleteForm>
      </div>
    </div>
  );
}

function Avatar({ player }: { player: PlayerRow }) {
  if (player.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={player.name}
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
        src={player.photo_url}
      />
    );
  }
  if (player.jersey_number) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
        <span className="text-[15px] font-semibold tracking-tight">
          {player.jersey_number}
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/70">
      {player.name ? (
        <span className="text-[13px] font-semibold tracking-tight">
          {initials(player.name)}
        </span>
      ) : (
        <UserRound aria-hidden="true" className="h-5 w-5" />
      )}
    </div>
  );
}
