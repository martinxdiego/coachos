"use client";

import { useMemo, useState, type PointerEvent } from "react";
import {
  Copy,
  Move,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UsersRound
} from "lucide-react";
import { saveTacticBoard } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BoardElementType = "player" | "opponent" | "ball" | "cone" | "text" | "arrow";
type DragTarget = {
  id: string;
  offsetX?: number;
  offsetY?: number;
  point: "body" | "start" | "end";
};

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

interface BoardScene {
  id: string;
  name: string;
  elements: BoardElement[];
}

interface BoardState {
  version: 2;
  scenes: BoardScene[];
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

const formations: Record<string, number[]> = {
  "4-3-3": [1, 4, 3, 3],
  "4-2-3-1": [1, 4, 2, 3, 1],
  "3-5-2": [1, 3, 5, 2],
  "4-4-2": [1, 4, 4, 2],
  "3-4-3": [1, 3, 4, 3]
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function formationPosition(formation: string, index: number) {
  const lines = formations[formation] ?? formations["4-3-3"];
  let currentIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const count = lines[lineIndex];
    if (index >= currentIndex && index < currentIndex + count) {
      const playerIndex = index - currentIndex;
      const x = 12 + (lineIndex / Math.max(1, lines.length - 1)) * 68;
      const y = count === 1 ? 50 : 18 + (playerIndex / (count - 1)) * 64;
      return { x, y };
    }
    currentIndex += count;
  }

  return rosterPosition(index);
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

function playerElement(player: PlayerForBoard, index: number, position = rosterPosition(index)): BoardElement {
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
}

function createRosterElements(players: PlayerForBoard[]): BoardElement[] {
  return players.map((player, index) => playerElement(player, index));
}

function createFormationElements(players: PlayerForBoard[], formation: string): BoardElement[] {
  return players.map((player, index) =>
    playerElement(player, index, formationPosition(formation, index))
  );
}

function normalizeElements(value: unknown): BoardElement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): BoardElement[] => {
    if (!isRecord(item)) {
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

function normalizeBoardState(value: unknown): BoardState {
  if (isRecord(value) && Array.isArray(value.scenes)) {
    const scenes = value.scenes.flatMap((scene, index): BoardScene[] => {
      if (!isRecord(scene)) {
        return [];
      }

      return [
        {
          id: typeof scene.id === "string" ? scene.id : `scene-${index + 1}`,
          name:
            typeof scene.name === "string" ? scene.name : `Szene ${index + 1}`,
          elements: normalizeElements(scene.elements)
        }
      ];
    });

    if (scenes.length > 0) {
      return { version: 2, scenes };
    }
  }

  return {
    version: 2,
    scenes: [
      {
        id: "scene-1",
        name: "Szene 1",
        elements: normalizeElements(value)
      }
    ]
  };
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
  const initialBoardState = useMemo(
    () => normalizeBoardState(board.elements),
    [board.elements]
  );
  const rosterElements = useMemo(() => createRosterElements(players), [players]);
  const [boardState, setBoardState] = useState<BoardState>(initialBoardState);
  const [activeSceneId, setActiveSceneId] = useState(
    initialBoardState.scenes[0]?.id ?? "scene-1"
  );
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const activeScene =
    boardState.scenes.find((scene) => scene.id === activeSceneId) ??
    boardState.scenes[0];
  const elements = activeScene?.elements ?? [];
  const arrowElements = elements.filter((item) => item.type === "arrow");
  const markerId = `arrowhead-${board.id}-${activeSceneId}`;

  function setActiveElements(
    updater: BoardElement[] | ((current: BoardElement[]) => BoardElement[])
  ) {
    setBoardState((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === activeSceneId
          ? {
              ...scene,
              elements:
                typeof updater === "function" ? updater(scene.elements) : updater
            }
          : scene
      )
    }));
  }

  function addScene() {
    const nextScene: BoardScene = {
      id: crypto.randomUUID(),
      name: `Szene ${boardState.scenes.length + 1}`,
      elements: elements.map((item) => ({ ...item }))
    };

    setBoardState((current) => ({
      ...current,
      scenes: [...current.scenes, nextScene]
    }));
    setActiveSceneId(nextScene.id);
  }

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

    setActiveElements((current) => [
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

  function addRosterPlayer(player: PlayerForBoard) {
    if (elements.some((item) => item.playerId === player.id)) {
      return;
    }

    setActiveElements((current) => [
      ...current,
      playerElement(player, current.filter((item) => item.type === "player").length, {
        x: 48,
        y: 50
      })
    ]);
  }

  function loadRoster() {
    if (rosterElements.length === 0) {
      return;
    }

    setActiveElements((current) => [
      ...current.filter((item) => item.type !== "player"),
      ...rosterElements
    ]);
  }

  function applyFormation(formation: string) {
    if (players.length === 0) {
      return;
    }

    setActiveElements((current) => [
      ...current.filter((item) => item.type !== "player"),
      ...createFormationElements(players, formation)
    ]);
  }

  function fieldPoint(clientX: number, clientY: number) {
    const field = document.getElementById(`field-${board.id}`);
    if (!field) {
      return null;
    }

    const rect = field.getBoundingClientRect();
    return {
      x: clampPosition(((clientX - rect.left) / rect.width) * 100),
      y: clampPosition(((clientY - rect.top) / rect.height) * 100)
    };
  }

  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    target: DragTarget,
    item: BoardElement
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = fieldPoint(event.clientX, event.clientY);
    setDragTarget({
      ...target,
      offsetX: target.point === "body" && point ? point.x - item.x : 0,
      offsetY: target.point === "body" && point ? point.y - item.y : 0
    });
  }

  function updatePosition(clientX: number, clientY: number) {
    if (!dragTarget) {
      return;
    }

    const point = fieldPoint(clientX, clientY);
    if (!point) {
      return;
    }

    setActiveElements((current) =>
      current.map((item) => {
        if (item.id !== dragTarget.id) {
          return item;
        }

        if (dragTarget.point === "end") {
          return { ...item, x2: point.x, y2: point.y };
        }

        if (dragTarget.point === "start") {
          return { ...item, x: point.x, y: point.y };
        }

        const x = clampPosition(point.x - (dragTarget.offsetX ?? 0));
        const y = clampPosition(point.y - (dragTarget.offsetY ?? 0));

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

  function resetBoard() {
    setBoardState(initialBoardState);
    setActiveSceneId(initialBoardState.scenes[0]?.id ?? "scene-1");
  }

  return (
    <div className="space-y-4">
      <form action={saveTacticBoard} className="space-y-4">
        <input name="id" type="hidden" value={board.id} />
        <input name="elements" type="hidden" value={JSON.stringify(boardState)} />
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

      <div className="flex flex-wrap items-center gap-2 no-print">
        {boardState.scenes.map((scene) => (
          <button
            className={cn(
              "h-9 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-secondary",
              scene.id === activeSceneId &&
                "border-slate-950 bg-slate-950 text-white hover:bg-slate-900"
            )}
            key={scene.id}
            onClick={() => setActiveSceneId(scene.id)}
            type="button"
          >
            {scene.name}
          </button>
        ))}
        <Button onClick={addScene} size="sm" type="button" variant="outline">
          <Copy aria-hidden="true" className="h-4 w-4" />
          Szene duplizieren
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <aside className="space-y-3 rounded-xl border border-border bg-background/80 p-3 no-print">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Kader</p>
              <Badge variant="secondary">{players.length}</Badge>
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {players.length > 0 ? (
                players.map((player) => {
                  const isOnBoard = elements.some(
                    (item) => item.playerId === player.id
                  );

                  return (
                    <button
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 text-left text-sm transition hover:border-primary/40",
                        isOnBoard && "bg-emerald-50 text-emerald-950"
                      )}
                      key={player.id}
                      onClick={() => addRosterPlayer(player)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {player.jersey_number ? `#${player.jersey_number} ` : ""}
                          {player.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {player.position ?? "Ohne Position"}
                        </span>
                      </span>
                      <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Erstelle zuerst Spieler im Kader.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-semibold">Formation</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(formations).map((formation) => (
                <Button
                  disabled={players.length === 0}
                  key={formation}
                  onClick={() => applyFormation(formation)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {formation}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-3">
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
            <Button onClick={resetBoard} size="sm" type="button" variant="ghost">
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Zurücksetzen
            </Button>
            <Button
              onClick={() => setActiveElements([])}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Szene leeren
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
                    markerEnd={`url(#${markerId})`}
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
                  id={markerId}
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
                      startDrag(event, { id: item.id, point: "start" }, item)
                    }
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    title="Pfeilstart ziehen"
                    type="button"
                  />
                  <button
                    aria-label="Pfeil verschieben"
                    className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border border-white bg-slate-950/85 text-white shadow-lg"
                    onPointerDown={(event) =>
                      startDrag(event, { id: item.id, point: "body" }, item)
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
                      startDrag(event, { id: item.id, point: "end" }, item)
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
                    startDrag(event, { id: item.id, point: "body" }, item)
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
      </div>
    </div>
  );
}
