"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent
} from "react";
import {
  Copy,
  Grid3x3,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  UsersRound
} from "lucide-react";
import { saveTacticBoard } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BoardElementType =
  | "player"
  | "opponent"
  | "ball"
  | "cone"
  | "text"
  | "arrow";

type ArrowKind = "pass" | "run" | "shot" | "dribble";

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
  arrowKind?: ArrowKind;
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

const validArrowKinds = new Set<ArrowKind>([
  "pass",
  "run",
  "shot",
  "dribble"
]);

const HISTORY_LIMIT = 50;

const arrowKindLabels: Record<ArrowKind, string> = {
  pass: "Pass",
  run: "Lauf",
  shot: "Schuss",
  dribble: "Dribbling"
};

interface ArrowVisual {
  stroke: string;
  strokeDasharray?: string;
  strokeWidth: number;
  markerFill: string;
}

const arrowVisuals: Record<ArrowKind, ArrowVisual> = {
  pass: {
    stroke: "#ffffff",
    strokeWidth: 2.5,
    markerFill: "#ffffff"
  },
  run: {
    stroke: "#ffffff",
    strokeDasharray: "8 5",
    strokeWidth: 2.5,
    markerFill: "#ffffff"
  },
  shot: {
    stroke: "#ef4444",
    strokeWidth: 3,
    markerFill: "#ef4444"
  },
  dribble: {
    stroke: "#facc15",
    strokeDasharray: "2 4",
    strokeWidth: 2.5,
    markerFill: "#facc15"
  }
};

function clampPosition(value: number) {
  return Math.min(96, Math.max(4, value));
}

function snapToGrid(value: number, gridSize: number) {
  const snapped = Math.round(value / gridSize) * gridSize;
  return clampPosition(snapped);
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

function playerElement(
  player: PlayerForBoard,
  index: number,
  position = rosterPosition(index)
): BoardElement {
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

function createFormationElements(
  players: PlayerForBoard[],
  formation: string
): BoardElement[] {
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

    const arrowKind =
      candidate.arrowKind && validArrowKinds.has(candidate.arrowKind)
        ? candidate.arrowKind
        : candidate.type === "arrow"
          ? "run" // legacy arrows default to dashed run paths
          : undefined;

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
        color: candidate.color,
        arrowKind
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
            typeof scene.name === "string"
              ? scene.name
              : `Szene ${index + 1}`,
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

export function TacticBoardEditor({
  board,
  players
}: TacticBoardEditorProps) {
  const initialBoardState = useMemo(
    () => normalizeBoardState(board.elements),
    [board.elements]
  );
  const rosterElements = useMemo(
    () => createRosterElements(players),
    [players]
  );

  const [boardState, setBoardState] =
    useState<BoardState>(initialBoardState);
  const [activeSceneId, setActiveSceneId] = useState(
    initialBoardState.scenes[0]?.id ?? "scene-1"
  );

  // History stack: snapshots of `boardState` BEFORE each committed mutation.
  // Pointer-drag intermediates are NOT pushed — only the pre-drag snapshot.
  const [past, setPast] = useState<BoardState[]>([]);
  const [future, setFuture] = useState<BoardState[]>([]);

  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  // Holds the boardState at pointerDown so we can push exactly one history
  // entry per drag gesture once it ends — even if many move events fired.
  const dragSnapshotRef = useRef<BoardState | null>(null);

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapSize, setSnapSize] = useState(5); // 5% grid by default
  const [activeArrowKind, setActiveArrowKind] = useState<ArrowKind>("run");

  const activeScene =
    boardState.scenes.find((scene) => scene.id === activeSceneId) ??
    boardState.scenes[0];
  const elements = activeScene?.elements ?? [];
  const arrowElements = elements.filter((item) => item.type === "arrow");
  const markerIdBase = `arrowhead-${board.id}-${activeSceneId}`;

  const pushHistory = useCallback((snapshot: BoardState) => {
    setPast((current) => {
      const next = [...current, snapshot];
      if (next.length > HISTORY_LIMIT) {
        next.shift();
      }
      return next;
    });
    setFuture([]);
  }, []);

  // Commit a mutation that should be undoable.
  const commit = useCallback(
    (updater: (state: BoardState) => BoardState) => {
      setBoardState((current) => {
        const next = updater(current);
        if (next === current) return current;
        pushHistory(current);
        return next;
      });
    },
    [pushHistory]
  );

  const undo = useCallback(() => {
    setPast((currentPast) => {
      if (currentPast.length === 0) return currentPast;
      const previous = currentPast[currentPast.length - 1];
      const remaining = currentPast.slice(0, -1);

      setBoardState((current) => {
        setFuture((currentFuture) => [...currentFuture, current]);
        return previous;
      });

      return remaining;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((currentFuture) => {
      if (currentFuture.length === 0) return currentFuture;
      const next = currentFuture[currentFuture.length - 1];
      const remaining = currentFuture.slice(0, -1);

      setBoardState((current) => {
        setPast((currentPast) => {
          const nextPast = [...currentPast, current];
          if (nextPast.length > HISTORY_LIMIT) nextPast.shift();
          return nextPast;
        });
        return next;
      });

      return remaining;
    });
  }, []);

  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z keyboard shortcuts.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      // Don't hijack typing inside form fields (title/description).
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const isUndo =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z";
      const isRedo =
        (event.metaKey || event.ctrlKey) &&
        ((event.shiftKey && event.key.toLowerCase() === "z") ||
          event.key.toLowerCase() === "y");

      if (isUndo) {
        event.preventDefault();
        undo();
      } else if (isRedo) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  function setActiveElements(
    updater: BoardElement[] | ((current: BoardElement[]) => BoardElement[])
  ) {
    commit((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === activeSceneId
          ? {
              ...scene,
              elements:
                typeof updater === "function"
                  ? updater(scene.elements)
                  : updater
            }
          : scene
      )
    }));
  }

  // Live-only mutation during drag — no history push.
  function liveUpdateActiveElements(
    updater: (current: BoardElement[]) => BoardElement[]
  ) {
    setBoardState((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === activeSceneId
          ? { ...scene, elements: updater(scene.elements) }
          : scene
      )
    }));
  }

  function addScene() {
    commit((current) => {
      const nextScene: BoardScene = {
        id: crypto.randomUUID(),
        name: `Szene ${current.scenes.length + 1}`,
        elements: (current.scenes.find((s) => s.id === activeSceneId)
          ?.elements ?? []
        ).map((item) => ({ ...item }))
      };
      // Switch view AFTER state commits.
      queueMicrotask(() => setActiveSceneId(nextScene.id));
      return { ...current, scenes: [...current.scenes, nextScene] };
    });
  }

  function maybeSnap(value: number) {
    return snapEnabled ? snapToGrid(value, snapSize) : clampPosition(value);
  }

  function addElement(type: BoardElementType, arrowKind?: ArrowKind) {
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
                ? arrowKindLabels[arrowKind ?? "run"]
                : "Notiz";

    setActiveElements((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        label,
        x: maybeSnap(48),
        y: maybeSnap(50),
        x2: type === "arrow" ? maybeSnap(66) : undefined,
        y2: type === "arrow" ? maybeSnap(38) : undefined,
        arrowKind: type === "arrow" ? (arrowKind ?? activeArrowKind) : undefined
      }
    ]);
  }

  function addArrow(kind: ArrowKind) {
    setActiveArrowKind(kind);
    addElement("arrow", kind);
  }

  function addRosterPlayer(player: PlayerForBoard) {
    if (elements.some((item) => item.playerId === player.id)) {
      return;
    }

    setActiveElements((current) => [
      ...current,
      playerElement(
        player,
        current.filter((item) => item.type === "player").length,
        {
          x: maybeSnap(48),
          y: maybeSnap(50)
        }
      )
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
    dragSnapshotRef.current = boardState;
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

    const snapX = (v: number) => maybeSnap(v);
    const snapY = (v: number) => maybeSnap(v);

    liveUpdateActiveElements((current) =>
      current.map((item) => {
        if (item.id !== dragTarget.id) {
          return item;
        }

        if (dragTarget.point === "end") {
          return { ...item, x2: snapX(point.x), y2: snapY(point.y) };
        }

        if (dragTarget.point === "start") {
          return { ...item, x: snapX(point.x), y: snapY(point.y) };
        }

        const x = snapX(point.x - (dragTarget.offsetX ?? 0));
        const y = snapY(point.y - (dragTarget.offsetY ?? 0));

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

  function endDrag() {
    if (dragTarget && dragSnapshotRef.current) {
      const snapshot = dragSnapshotRef.current;
      // Only push to history if the drag actually changed anything.
      setBoardState((current) => {
        if (current !== snapshot) {
          pushHistory(snapshot);
        }
        return current;
      });
    }
    dragSnapshotRef.current = null;
    setDragTarget(null);
  }

  function deleteElement(id: string) {
    setActiveElements((current) => current.filter((item) => item.id !== id));
  }

  function resetBoard() {
    commit(() => initialBoardState);
    setActiveSceneId(initialBoardState.scenes[0]?.id ?? "scene-1");
  }

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return (
    <div className="space-y-4">
      <form action={saveTacticBoard} className="space-y-4">
        <input name="id" type="hidden" value={board.id} />
        <input
          name="elements"
          type="hidden"
          value={JSON.stringify(boardState)}
        />
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

        <span className="ml-auto flex items-center gap-2">
          <Button
            disabled={!canUndo}
            onClick={undo}
            size="sm"
            title="Rückgängig (Strg/Cmd+Z)"
            type="button"
            variant="outline"
          >
            <Undo2 aria-hidden="true" className="h-4 w-4" />
            Rückgängig
          </Button>
          <Button
            disabled={!canRedo}
            onClick={redo}
            size="sm"
            title="Wiederherstellen (Strg/Cmd+Shift+Z)"
            type="button"
            variant="outline"
          >
            <Redo2 aria-hidden="true" className="h-4 w-4" />
            Wiederherstellen
          </Button>
        </span>
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
                          {player.jersey_number
                            ? `#${player.jersey_number} `
                            : ""}
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

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-semibold">Raster</p>
            <button
              aria-pressed={snapEnabled}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm transition",
                snapEnabled
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                  : "bg-white hover:border-foreground/40"
              )}
              onClick={() => setSnapEnabled((current) => !current)}
              type="button"
            >
              <span className="flex items-center gap-2">
                <Grid3x3 aria-hidden="true" className="h-4 w-4" />
                Snap-to-Grid
              </span>
              <span className="text-xs font-medium uppercase tracking-wide">
                {snapEnabled ? "An" : "Aus"}
              </span>
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { size: 2.5, label: "Fein" },
                { size: 5, label: "Mittel" },
                { size: 10, label: "Grob" }
              ].map((preset) => (
                <button
                  className={cn(
                    "h-8 rounded-md border text-xs font-medium transition",
                    snapSize === preset.size
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-border bg-white hover:border-foreground/40",
                    !snapEnabled && "opacity-50"
                  )}
                  disabled={!snapEnabled}
                  key={preset.size}
                  onClick={() => setSnapSize(preset.size)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 no-print">
            <Button
              onClick={() => addElement("player")}
              size="sm"
              type="button"
            >
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
            <Button
              onClick={() => addElement("opponent")}
              size="sm"
              type="button"
              variant="secondary"
            >
              Gegner
            </Button>
            <Button
              onClick={() => addElement("ball")}
              size="sm"
              type="button"
              variant="outline"
            >
              Ball
            </Button>
            <Button
              onClick={() => addElement("cone")}
              size="sm"
              type="button"
              variant="outline"
            >
              Hütchen
            </Button>
            <Button
              onClick={() => addElement("text")}
              size="sm"
              type="button"
              variant="outline"
            >
              Notiz
            </Button>
            <Button
              onClick={resetBoard}
              size="sm"
              type="button"
              variant="ghost"
            >
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

          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 no-print">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pfeile
            </span>
            {(Object.keys(arrowVisuals) as ArrowKind[]).map((kind) => {
              const visual = arrowVisuals[kind];
              return (
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                    activeArrowKind === kind
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-border bg-white hover:border-foreground/40"
                  )}
                  key={kind}
                  onClick={() => addArrow(kind)}
                  title={`${arrowKindLabels[kind]} hinzufügen`}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-3 w-7"
                    viewBox="0 0 28 12"
                  >
                    <line
                      stroke={
                        activeArrowKind === kind ? "#ffffff" : visual.stroke
                      }
                      strokeDasharray={visual.strokeDasharray}
                      strokeLinecap="round"
                      strokeWidth={visual.strokeWidth}
                      x1="2"
                      x2="22"
                      y1="6"
                      y2="6"
                    />
                    <polygon
                      fill={
                        activeArrowKind === kind ? "#ffffff" : visual.markerFill
                      }
                      points="22,2 28,6 22,10"
                    />
                  </svg>
                  {arrowKindLabels[kind]}
                </button>
              );
            })}
          </div>

          <div
            className="relative aspect-[1.55] min-h-[420px] overflow-hidden rounded-2xl border-4 border-emerald-950/10 bg-emerald-700 shadow-inner [print-color-adjust:exact]"
            id={`field-${board.id}`}
            onPointerCancel={endDrag}
            onPointerMove={(event) =>
              updatePosition(event.clientX, event.clientY)
            }
            onPointerUp={endDrag}
          >
            <div className="absolute inset-4 rounded-2xl border-2 border-white/70" />
            <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] border-l-2 border-white/60" />
            <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
            <div className="absolute left-4 top-1/2 h-36 w-24 -translate-y-1/2 border-2 border-l-0 border-white/60" />
            <div className="absolute right-4 top-1/2 h-36 w-24 -translate-y-1/2 border-2 border-r-0 border-white/60" />

            {snapEnabled ? (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-25 no-print"
              >
                <defs>
                  <pattern
                    height={`${snapSize}%`}
                    id={`grid-${board.id}`}
                    patternUnits="userSpaceOnUse"
                    width={`${snapSize}%`}
                  >
                    <path
                      d={`M ${snapSize} 0 L 0 0 0 ${snapSize}`}
                      fill="none"
                      stroke="white"
                      strokeWidth="0.4"
                    />
                  </pattern>
                </defs>
                <rect
                  fill={`url(#grid-${board.id})`}
                  height="100%"
                  width="100%"
                />
              </svg>
            ) : null}

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                {(Object.keys(arrowVisuals) as ArrowKind[]).map((kind) => (
                  <marker
                    id={`${markerIdBase}-${kind}`}
                    key={kind}
                    markerHeight="7"
                    markerWidth="10"
                    orient="auto"
                    refX="10"
                    refY="3.5"
                  >
                    <polygon
                      fill={arrowVisuals[kind].markerFill}
                      points="0 0, 10 3.5, 0 7"
                    />
                  </marker>
                ))}
              </defs>
              {arrowElements.map((item) => {
                const end = arrowEnd(item);
                const kind = item.arrowKind ?? "run";
                const visual = arrowVisuals[kind];
                return (
                  <line
                    key={item.id}
                    markerEnd={`url(#${markerIdBase}-${kind})`}
                    stroke={item.color ?? visual.stroke}
                    strokeDasharray={visual.strokeDasharray}
                    strokeLinecap="round"
                    strokeWidth={visual.strokeWidth}
                    x1={`${item.x}%`}
                    x2={`${end.x}%`}
                    y1={`${item.y}%`}
                    y2={`${end.y}%`}
                  />
                );
              })}
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
                    title={`${arrowKindLabels[item.arrowKind ?? "run"]} verschieben — Doppelklick löscht`}
                    onDoubleClick={() => deleteElement(item.id)}
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
                  onDoubleClick={() => deleteElement(item.id)}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  title={`${item.name ?? item.label} — Doppelklick löscht`}
                  type="button"
                >
                  {item.type === "ball"
                    ? "●"
                    : item.type === "cone"
                      ? "▲"
                      : item.label}
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
