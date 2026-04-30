"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { Move, Plus, RotateCcw, Save, Trash2, UsersRound } from "lucide-react";
import { saveTacticBoard } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BoardElementType = "player" | "opponent" | "ball" | "cone" | "text" | "arrow";
type DragTarget = { id: string; point: "body" | "start" | "end" };

interface PlayerForBoard {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
}

interface BoardElement {
  id: string;
  type: BoardElementType;
  label: string;
  name?: string;
  playerId?: string;
  position?: string | null;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color?: string;
}

interface TacticBoardEditorProps {
  board: {
    id: string;
    title: string;
    description: string | null;
    elements: unknown;
  };
  players: PlayerForBoard[];
}

const rosterPositions = [
  { x: 12, y: 50 },
  { x: 28, y: 22 },
  { x: 28, y: 40 },
  { x: 28, y: 60 },
  { x: 28, y: 78 },
  { x: 50, y: 32 },
  { x: 50, y: 50 },
  { x: 50, y: 68 },
  { x: 72, y: 26 },
  { x: 80, y: 50 },
  { x: 72, y: 74 }
] as const;

const validTypes = new Set<BoardElementType>([
  "player",
  "opponent",
  "ball",
  "cone",
  "text",
  "arrow"
]);

function clampPosition(value: number) {
  return Math.min(96, Math.max(4, value));
}

function rosterPosition(index: number) {
  if (index < rosterPositions.length) {
    return rosterPositions[index];
  }

  const benchIndex = index - rosterPositions.length;
  return {
    x: 12 + (benchIndex % 9) * 9.5,
    y: 88 - Math.floor(benchIndex / 9) * 7
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.at(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function shortName(name?: string) {
  if (!name) {
    return null;
  }

  const parts = name.split(" ").filter(Boolean);
  return parts.at(-1) ?? name;
}

function createRosterElements(players: PlayerForBoard[]): BoardElement[] {
  return players.map((player, index) => {
    const position = rosterPosition(index);
    return {
      id: `player-${player.id}`,
      type: "player",
      label:
        player.jersey_number !== null
          ? String(player.jersey_number)
          : initials(player.name) || String(index + 1),
      name: player.name,
      playerId: player.id,
      position: player.position,
      x: position.x,
      y: position.y
    };
  });
}

function normalizeElements(value: unknown): BoardElement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): BoardElement[] => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<BoardElement>;
    if (
      !candidate.id ||
      !candidate.type ||
      !validTypes.has(candidate.type) ||
      typeof candidate.x !== "number" ||
      typeof candidate.y !== "number"
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        type: candidate.type,
        label: candidate.label ?? "",
        name: candidate.name,
        playerId: candidate.playerId,
        position: candidate.position,
        x: candidate.x,
        y: candidate.y,
        x2: typeof candidate.x2 === "number" ? candidate.x2 : undefined,
        y2: typeof candidate.y2 === "number" ? candidate.y2 : undefined,
        color: candidate.color
      }
    ];
  });
}

function elementClass(type: BoardElementType) {
  if (type === "player") {
    return "border-white bg-slate-950 text-white";
  }

  if (type === "opponent") {
    return "border-white bg-red-600 text-white";
  }

  if (type === "ball") {
    return "border-slate-950 bg-white text-slate-950";
  }

  if (type === "cone") {
    return "border-orange-200 bg-orange-500 text-white";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function arrowEnd(item: BoardElement) {
  return {
    x: item.x2 ?? item.x + 14,
    y: item.y2 ?? item.y - 12
  };
}

function playerLabelClass(y: number) {
  const shared =
    "pointer-events-none absolute left-1/2 max-w-24 -translate-x-1/2 truncate rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-medium text-white [print-color-adjust:exact]";

  return y > 82 ? `${shared} bottom-full mb-1` : `${shared} top-full mt-1`;
}

export function TacticBoardEditor({ board, players }: TacticBoardEditorProps) {
  const initialElements = useMemo(
    () => normalizeElements(board.elements),
    [board.elements]
  );
  const rosterElements = useMemo(() => createRosterElements(players), [players]);
  const [elements, setElements] = useState<BoardElement[]>(initialElements);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const arrowElements = elements.filter((item) => item.type === "arrow");

  function addElement(type: BoardElementType) {
    const label =
      type === "player"
        ? `${elements.filter((item) => item.type === "player").length + 1}`
        : type === "opponent"
          ? "G"
          : type === "ball"
            ? ""
            : type === "cone"
              ? ""
              : type === "arrow"
                ? "Laufweg"
                : "Notiz";

    setElements((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        label,
        x: 48,
        y: 50,
        x2: type === "arrow" ? 66 : undefined,
        y2: type === "arrow" ? 38 : undefined
      }
    ]);
  }

  function loadRoster() {
    if (rosterElements.length === 0) {
      return;
    }

    setElements((current) => [
      ...current.filter((item) => item.type !== "player"),
      ...rosterElements
    ]);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, target: DragTarget) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragTarget(target);
  }

  function updatePosition(clientX: number, clientY: number) {
    if (!dragTarget) {
      return;
    }

    const field = document.getElementById(`field-${board.id}`);
    if (!field) {
      return;
    }

    const rect = field.getBoundingClientRect();
    const x = clampPosition(((clientX - rect.left) / rect.width) * 100);
    const y = clampPosition(((clientY - rect.top) / rect.height) * 100);

    setElements((current) =>
      current.map((item) => {
        if (item.id !== dragTarget.id) {
          return item;
        }

        if (dragTarget.point === "end") {
          return { ...item, x2: x, y2: y };
        }

        if (dragTarget.point === "start") {
          return { ...item, x, y };
        }

        if (item.type === "arrow") {
          const end = arrowEnd(item);
          const deltaX = x - item.x;
          const deltaY = y - item.y;
          return {
            ...item,
            x,
            y,
            x2: clampPosition(end.x + deltaX),
            y2: clampPosition(end.y + deltaY)
          };
        }

        return { ...item, x, y };
      })
    );
  }

  return (
    <div className="space-y-4">
      <form action={saveTacticBoard} className="space-y-4">
        <input name="id" type="hidden" value={board.id} />
        <input name="elements" type="hidden" value={JSON.stringify(elements)} />
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input defaultValue={board.title} name="title" required />
          <Textarea
            className="min-h-10"
            defaultValue={board.description ?? ""}
            name="description"
            placeholder="Beschreibung"
          />
          <Button type="submit">
            <Save aria-hidden="true" className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 no-print">
        <Button onClick={() => addElement("player")} size="sm" type="button">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Spieler
        </Button>
        <Button
          disabled={rosterElements.length === 0}
          onClick={loadRoster}
          size="sm"
          title={
            rosterElements.length === 0
              ? "Erstelle zuerst Spieler im Kader."
              : "Teamspieler mit Rückennummern auf das Feld laden"
          }
          type="button"
          variant="secondary"
        >
          <UsersRound aria-hidden="true" className="h-4 w-4" />
          Kader laden
        </Button>
        <Button onClick={() => addElement("opponent")} size="sm" type="button" variant="secondary">
          Gegner
        </Button>
        <Button onClick={() => addElement("ball")} size="sm" type="button" variant="outline">
          Ball
        </Button>
        <Button onClick={() => addElement("cone")} size="sm" type="button" variant="outline">
          Hütchen
        </Button>
        <Button onClick={() => addElement("arrow")} size="sm" type="button" variant="outline">
          Pfeil
        </Button>
        <Button onClick={() => addElement("text")} size="sm" type="button" variant="outline">
          Notiz
        </Button>
        <Button
          onClick={() => setElements(initialElements)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Zurücksetzen
        </Button>
        <Button
          onClick={() => setElements([])}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Leeren
        </Button>
      </div>

      <div
        className="relative aspect-[1.55] min-h-[420px] overflow-hidden rounded-2xl border-4 border-emerald-950/10 bg-emerald-700 shadow-inner [print-color-adjust:exact]"
        id={`field-${board.id}`}
        onPointerCancel={() => setDragTarget(null)}
        onPointerMove={(event) => updatePosition(event.clientX, event.clientY)}
        onPointerUp={() => setDragTarget(null)}
      >
        <div className="absolute inset-4 rounded-2xl border-2 border-white/70" />
        <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] border-l-2 border-white/60" />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
        <div className="absolute left-4 top-1/2 h-36 w-24 -translate-y-1/2 border-2 border-l-0 border-white/60" />
        <div className="absolute right-4 top-1/2 h-36 w-24 -translate-y-1/2 border-2 border-r-0 border-white/60" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {arrowElements.map((item) => {
            const end = arrowEnd(item);
            return (
              <line
                key={item.id}
                markerEnd="url(#arrowhead)"
                stroke={item.color ?? "white"}
                strokeDasharray="7 5"
                strokeWidth="3"
                x1={`${item.x}%`}
                x2={`${end.x}%`}
                y1={`${item.y}%`}
                y2={`${end.y}%`}
              />
            );
          })}
          <defs>
            <marker
              id="arrowhead"
              markerHeight="7"
              markerWidth="10"
              orient="auto"
              refX="10"
              refY="3.5"
            >
              <polygon fill="white" points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>
        </svg>

        {arrowElements.map((item) => {
          const end = arrowEnd(item);
          const middle = {
            x: (item.x + end.x) / 2,
            y: (item.y + end.y) / 2
          };

          return (
            <div className="no-print" key={`${item.id}-handles`}>
              <button
                aria-label="Pfeilstart verschieben"
                className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-emerald-950 shadow-lg"
                onPointerDown={(event) =>
                  startDrag(event, { id: item.id, point: "start" })
                }
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                title="Pfeilstart ziehen"
                type="button"
              />
              <button
                aria-label="Pfeil verschieben"
                className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border border-white bg-slate-950/85 text-white shadow-lg"
                onPointerDown={(event) =>
                  startDrag(event, { id: item.id, point: "body" })
                }
                style={{ left: `${middle.x}%`, top: `${middle.y}%` }}
                title="Pfeil verschieben"
                type="button"
              >
                <Move aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                aria-label="Pfeilende verschieben"
                className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-white shadow-lg"
                onPointerDown={(event) =>
                  startDrag(event, { id: item.id, point: "end" })
                }
                style={{ left: `${end.x}%`, top: `${end.y}%` }}
                title="Pfeilende ziehen"
                type="button"
              />
            </div>
          );
        })}

        {elements
          .filter((item) => item.type !== "arrow")
          .map((item) => (
            <button
              className={`absolute flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border px-2 text-xs font-semibold shadow-lg transition hover:scale-105 [print-color-adjust:exact] ${elementClass(item.type)}`}
              key={item.id}
              onPointerDown={(event) =>
                startDrag(event, { id: item.id, point: "body" })
              }
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              title={item.name ?? item.label}
              type="button"
            >
              {item.type === "ball" ? "●" : item.type === "cone" ? "▲" : item.label}
              {item.type === "player" && item.name ? (
                <span className={playerLabelClass(item.y)}>
                  {shortName(item.name)}
                </span>
              ) : null}
            </button>
          ))}
      </div>
    </div>
  );
}
