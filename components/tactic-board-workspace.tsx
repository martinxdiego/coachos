"use client";

import { useState } from "react";
import { Clapperboard, PencilRuler, Presentation } from "lucide-react";
import { TacticBoardEditor } from "@/components/tactic-board-editor";
import { cn } from "@/lib/utils";

type Mode = "plan" | "animate" | "present";

type Board = {
  id: string;
  title: string;
  description: string | null;
  elements: unknown;
};

type Player = {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
};

const modes: Array<{ id: Mode; label: string; hint: string; icon: typeof PencilRuler }> = [
  { id: "plan", label: "Planen", hint: "Elemente bearbeiten", icon: PencilRuler },
  { id: "animate", label: "Animieren", hint: "Abläufe prüfen", icon: Clapperboard },
  { id: "present", label: "Präsentieren", hint: "Fokus aufs Spielfeld", icon: Presentation }
];

export function TacticBoardWorkspace({ board, players }: { board: Board; players: Player[] }) {
  const [mode, setMode] = useState<Mode>("plan");

  return (
    <div className="space-y-4">
      <div className="no-print grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-secondary/60 p-1 sm:flex sm:w-fit">
        {modes.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-pressed={mode === item.id}
              className={cn(
                "flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:justify-start",
                mode === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={item.id}
              onClick={() => setMode(item.id)}
              title={item.hint}
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <TacticBoardEditor board={board} mode={mode} players={players} />
    </div>
  );
}
