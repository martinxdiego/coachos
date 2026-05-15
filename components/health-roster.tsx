"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

export type Risk = "red" | "yellow" | "green";

export interface HealthRow {
  playerId: string;
  playerName: string;
  position: string | null;
  category: string | null;
  risk: Risk | null;
  riskLabel: string;
  riskScore: number;
  checkinDate: string | null;
  fatigue: number | null;
  energy: number | null;
  pain: number | null;
}

type SortKey = "name" | "risk" | "date" | "energy" | "pain";

const riskOrder: Record<Risk, number> = { red: 3, yellow: 2, green: 1 };

const riskClass: Record<Risk, string> = {
  red: "bg-red-100 text-red-900 ring-red-300",
  yellow: "bg-amber-100 text-amber-900 ring-amber-300",
  green: "bg-emerald-100 text-emerald-900 ring-emerald-300"
};

function rowAccent(risk: Risk | null) {
  if (risk === "red") return "border-l-red-500";
  if (risk === "yellow") return "border-l-amber-500";
  if (risk === "green") return "border-l-emerald-500";
  return "border-l-slate-200";
}

function valueClass(value: number | null, type: "low-good" | "high-good") {
  if (value === null) return "text-muted-foreground";
  if (type === "high-good") {
    if (value <= 2) return "text-red-700 font-semibold";
    if (value === 3) return "text-amber-700 font-medium";
    return "text-emerald-700 font-medium";
  }
  if (value >= 4) return "text-red-700 font-semibold";
  if (value === 3) return "text-amber-700 font-medium";
  return "text-emerald-700 font-medium";
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown aria-hidden="true" className="h-3 w-3" />;
  return dir === "asc" ? (
    <ArrowUp aria-hidden="true" className="h-3 w-3" />
  ) : (
    <ArrowDown aria-hidden="true" className="h-3 w-3" />
  );
}

export function HealthRoster({ rows }: { rows: HealthRow[] }) {
  const [filter, setFilter] = useState<"all" | Risk | "no-checkin">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "risk",
    dir: "desc"
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "no-checkin" && row.risk !== null) return false;
      if (filter !== "all" && filter !== "no-checkin" && row.risk !== filter)
        return false;
      if (term && !row.playerName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, filter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let diff = 0;
      switch (sort.key) {
        case "name":
          diff = a.playerName.localeCompare(b.playerName, "de");
          break;
        case "risk":
          diff = a.riskScore - b.riskScore;
          break;
        case "date":
          diff =
            (a.checkinDate ? new Date(a.checkinDate).getTime() : 0) -
            (b.checkinDate ? new Date(b.checkinDate).getTime() : 0);
          break;
        case "energy":
          diff = (a.energy ?? -1) - (b.energy ?? -1);
          break;
        case "pain":
          diff = (a.pain ?? -1) - (b.pain ?? -1);
          break;
      }
      return sort.dir === "asc" ? diff : -diff;
    });
    return list;
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    );
  }

  const counts = useMemo(() => {
    return {
      red: rows.filter((row) => row.risk === "red").length,
      yellow: rows.filter((row) => row.risk === "yellow").length,
      green: rows.filter((row) => row.risk === "green").length,
      none: rows.filter((row) => row.risk === null).length
    };
  }, [rows]);

  const filters: { id: typeof filter; label: string; count: number; tone: string }[] = [
    { id: "all", label: "Alle", count: rows.length, tone: "bg-slate-900 text-white" },
    { id: "red", label: "Rot", count: counts.red, tone: "bg-red-600 text-white" },
    { id: "yellow", label: "Gelb", count: counts.yellow, tone: "bg-amber-500 text-amber-950" },
    { id: "green", label: "Grün", count: counts.green, tone: "bg-emerald-600 text-white" },
    { id: "no-checkin", label: "Kein Check", count: counts.none, tone: "bg-slate-300 text-slate-900" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => {
            const active = filter === item.id;
            return (
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium tracking-tight transition active:scale-[0.97]",
                  active
                    ? `${item.tone} border-transparent shadow-sm`
                    : "border-border bg-card text-foreground hover:border-foreground/30"
                )}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0 text-[10px] font-semibold",
                    active ? "bg-white/25" : "bg-secondary"
                  )}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
        <Input
          className="sm:w-64"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Spieler suchen…"
          value={search}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <button
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("name")}
                  type="button"
                >
                  Spieler
                  <SortIcon active={sort.key === "name"} dir={sort.dir} />
                </button>
              </th>
              <th className="px-3 py-2">
                <button
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("risk")}
                  type="button"
                >
                  Belastung
                  <SortIcon active={sort.key === "risk"} dir={sort.dir} />
                </button>
              </th>
              <th className="hidden px-3 py-2 sm:table-cell">
                <button
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("date")}
                  type="button"
                >
                  Letzter Check
                  <SortIcon active={sort.key === "date"} dir={sort.dir} />
                </button>
              </th>
              <th className="hidden px-3 py-2 md:table-cell">
                <button
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("energy")}
                  type="button"
                >
                  Energie
                  <SortIcon active={sort.key === "energy"} dir={sort.dir} />
                </button>
              </th>
              <th className="hidden px-3 py-2 md:table-cell">
                <button
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("pain")}
                  type="button"
                >
                  Schmerz
                  <SortIcon active={sort.key === "pain"} dir={sort.dir} />
                </button>
              </th>
              <th className="px-3 py-2 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="px-4 py-8">
                    <EmptyState
                      title={
                        rows.length === 0
                          ? "Noch keine Check-ins vorhanden."
                          : "Keine Spieler in dieser Auswahl."
                      }
                      body={
                        rows.length === 0
                          ? "Sobald Spieler ihren täglichen Check-in ausfüllen, erscheinen sie hier."
                          : "Filter anpassen oder auf 'Alle' klicken."
                      }
                      action={
                        filter !== "all" ? (
                          <Button
                            onClick={() => setFilter("all")}
                            type="button"
                            variant="outline"
                          >
                            Filter zurücksetzen
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  className={cn(
                    "border-t border-border border-l-4 bg-background/70",
                    rowAccent(row.risk)
                  )}
                  key={row.playerId}
                >
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold tracking-tight">{row.playerName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.position ?? "Position offen"}
                      {row.category ? ` · ${row.category}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {row.risk ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                          riskClass[row.risk]
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            row.risk === "red"
                              ? "bg-red-600"
                              : row.risk === "yellow"
                                ? "bg-amber-500"
                                : "bg-emerald-600"
                          )}
                        />
                        {row.riskLabel}
                      </span>
                    ) : (
                      <Badge variant="outline">Kein Check</Badge>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 align-top text-muted-foreground sm:table-cell">
                    {row.checkinDate ? formatDate(row.checkinDate) : "—"}
                  </td>
                  <td className={cn("hidden px-3 py-3 align-top md:table-cell", valueClass(row.energy, "high-good"))}>
                    {row.energy !== null ? `${row.energy}/5` : "—"}
                  </td>
                  <td className={cn("hidden px-3 py-3 align-top md:table-cell", valueClass(row.pain, "low-good"))}>
                    {row.pain !== null ? `${row.pain}/5` : "—"}
                  </td>
                  <td className="px-3 py-3 align-top text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/players/${row.playerId}`}>Verlauf</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
