"use client";

import { Goal, Plus, Square, Trash2, UserRoundCog } from "lucide-react";
import { addMatchEvent, deleteMatchEvent } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MatchEventRow, PlayerOption } from "@/components/matches-roster";

const EVENT_LABELS: Record<MatchEventRow["type"], string> = {
  GOAL: "Tor",
  ASSIST: "Assist",
  YELLOW_CARD: "Gelb",
  RED_CARD: "Rot",
  SUBSTITUTION: "Wechsel"
};

function EventIcon({ type }: { type: MatchEventRow["type"] }) {
  if (type === "GOAL") return <Goal aria-hidden="true" className="h-4 w-4 text-emerald-600" />;
  if (type === "ASSIST") return <Plus aria-hidden="true" className="h-4 w-4 text-sky-600" />;
  if (type === "YELLOW_CARD")
    return <Square aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" />;
  if (type === "RED_CARD")
    return <Square aria-hidden="true" className="h-3.5 w-3.5 text-red-600" />;
  return <UserRoundCog aria-hidden="true" className="h-4 w-4 text-muted-foreground" />;
}

interface MatchEventsEditorProps {
  matchId: string;
  players: PlayerOption[];
  events: MatchEventRow[];
}

export function MatchEventsEditor({ matchId, players, events }: MatchEventsEditorProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/70 p-4">
      <p className="text-sm font-semibold">Spielereignisse</p>

      {events.length > 0 ? (
        <ul className="space-y-1.5">
          {events.map((event) => (
            <li
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-[13px]"
              key={event.id}
            >
              <span className="flex min-w-0 items-center gap-2">
                <EventIcon type={event.type} />
                <span className="truncate">
                  {EVENT_LABELS[event.type]} · {event.player_name}
                  {event.minute != null ? ` · ${event.minute}'` : ""}
                </span>
              </span>
              <form action={deleteMatchEvent}>
                <input name="id" type="hidden" value={event.id} />
                <Button
                  aria-label="Ereignis löschen"
                  className="h-7 w-7 text-muted-foreground hover:text-red-600"
                  size="icon"
                  type="submit"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Noch keine Ereignisse erfasst.
        </p>
      )}

      <form action={addMatchEvent} className="flex flex-wrap items-center gap-2">
        <input name="match_id" type="hidden" value={matchId} />
        <select
          aria-label="Spieler"
          className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          name="player_id"
          required
        >
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.jersey_number ? `#${player.jersey_number} ` : ""}
              {player.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Ereignistyp"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue="GOAL"
          name="type"
        >
          {(Object.keys(EVENT_LABELS) as MatchEventRow["type"][]).map((type) => (
            <option key={type} value={type}>
              {EVENT_LABELS[type]}
            </option>
          ))}
        </select>
        <Input
          aria-label="Minute"
          className="h-9 w-20"
          max={130}
          min={0}
          name="minute"
          placeholder="Min."
          type="number"
        />
        <Button size="sm" type="submit">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Hinzufügen
        </Button>
      </form>
    </div>
  );
}
