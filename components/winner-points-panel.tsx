"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Medal, Plus, Sparkles } from "lucide-react";
import { addWinnerPoints } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, todayIsoDate } from "@/lib/utils";
import type { WinnerPointContextType } from "@/lib/types";

type PlayerOption = {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
  team_category: string | null;
};

const contextOptions: { label: string; value: WinnerPointContextType }[] = [
  { label: "Training", value: "training" },
  { label: "Spiel", value: "match" },
  { label: "Event", value: "event" },
  { label: "Montag", value: "monday_training" },
  { label: "Sonstiges", value: "other" }
];

export function WinnerPointsPanel({ players }: { players: PlayerOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contextType, setContextType] =
    useState<WinnerPointContextType>("training");
  const [contextLabel, setContextLabel] = useState("");
  const [reason, setReason] = useState("");
  const [awardedAt, setAwardedAt] = useState(todayIsoDate());
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [flashPlayerId, setFlashPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function award(playerId: string, points: number) {
    const formData = new FormData();
    formData.set("player_id", playerId);
    formData.set("points", String(points));
    formData.set("context_type", contextType);
    formData.set("context_label", contextLabel);
    formData.set("reason", reason);
    formData.set("awarded_at", awardedAt);

    setActivePlayerId(playerId);
    setError(null);
    startTransition(async () => {
      try {
        await addWinnerPoints(formData);
        setFlashPlayerId(playerId);
        window.setTimeout(() => setFlashPlayerId(null), 900);
        router.refresh();
      } catch (awardError) {
        setError(
          awardError instanceof Error
            ? awardError.message
            : "Winnerpunkte konnten nicht gespeichert werden."
        );
      } finally {
        setActivePlayerId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-950">
              Schnellvergabe
            </p>
            <p className="mt-1 text-sm leading-6 text-emerald-950/75">
              Kontext einmal setzen, danach pro Spieler mit einem Tap Punkte
              vergeben.
            </p>
          </div>
          <Medal aria-hidden="true" className="h-5 w-5 text-emerald-700" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="winner-context-type">Kontext</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="winner-context-type"
              onChange={(event) =>
                setContextType(event.target.value as WinnerPointContextType)
              }
              value={contextType}
            >
              {contextOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="winner-date">Datum</Label>
            <Input
              id="winner-date"
              onChange={(event) => setAwardedAt(event.target.value)}
              type="date"
              value={awardedAt}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="winner-context-label">Event / Gegner / Einheit</Label>
            <Input
              id="winner-context-label"
              onChange={(event) => setContextLabel(event.target.value)}
              placeholder="z.B. vs FC Ebikon, Montag Block 3"
              value={contextLabel}
            />
          </div>
          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="winner-reason">Begründung optional</Label>
            <Textarea
              id="winner-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Pressingaktion, Teamgeist, entscheidender Laufweg..."
              value={reason}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => {
          const isActive = activePlayerId === player.id && isPending;
          const isFlashing = flashPlayerId === player.id;

          return (
            <div
              className={cn(
                "rounded-xl border border-border bg-white p-4 transition-all duration-300",
                isFlashing &&
                  "scale-[1.02] border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-500/20"
              )}
              key={player.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{player.name}</p>
                    {isFlashing ? (
                      <Badge variant="success">
                        <Sparkles aria-hidden="true" className="mr-1 h-3 w-3" />
                        gespeichert
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {player.jersey_number ? `#${player.jersey_number}` : "Ohne Nr."}
                    {player.position ? ` · ${player.position}` : ""}
                    {player.team_category ? ` · ${player.team_category}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[1, 3, 5].map((points) => (
                  <Button
                    disabled={isPending}
                    key={points}
                    onClick={() => award(player.id, points)}
                    type="button"
                    variant={points === 3 ? "default" : "outline"}
                  >
                    {isActive ? "..." : `+${points}`}
                  </Button>
                ))}
              </div>
              <form action={addWinnerPoints} className="mt-3 flex gap-2">
                <input name="player_id" type="hidden" value={player.id} />
                <input name="context_type" type="hidden" value={contextType} />
                <input name="context_label" type="hidden" value={contextLabel} />
                <input name="reason" type="hidden" value={reason} />
                <input name="awarded_at" type="hidden" value={awardedAt} />
                <Input
                  aria-label={`Winnerpunkte fuer ${player.name}`}
                  defaultValue="2"
                  max={50}
                  min={1}
                  name="points"
                  type="number"
                />
                <Button type="submit" variant="secondary">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
