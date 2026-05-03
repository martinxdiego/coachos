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
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Square,
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
  | "material"
  | "zone"
  | "arrow";

type ArrowKind = "pass" | "run" | "shot" | "dribble";

type MaterialKind =
  | "ball-orange"
  | "ball-white"
  | "ball-blue"
  | "pole"
  | "hurdle"
  | "ring"
  | "ladder"
  | "mannequin"
  | "mini-goal-small"
  | "mini-goal-large"
  | "pad";

type ZoneColor = "yellow" | "red" | "blue" | "green";

type DragTarget = {
  id: string;
  offsetX?: number;
  offsetY?: number;
  point: "body" | "start" | "end" | "resize";
};

interface PlayerForBoard {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
}

interface PathPoint {
  x: number;
  y: number;
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
  width?: number;
  height?: number;
  color?: string;
  arrowKind?: ArrowKind;
  materialKind?: MaterialKind;
  zoneColor?: ZoneColor;
  rotation?: number;
  path?: PathPoint[];
}

interface BoardScene {
  id: string;
  name: string;
  elements: BoardElement[];
}

interface BoardState {
  version: 3;
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
  "material",
  "zone",
  "arrow"
]);

const validArrowKinds = new Set<ArrowKind>([
  "pass",
  "run",
  "shot",
  "dribble"
]);

const validMaterialKinds = new Set<MaterialKind>([
  "ball-orange",
  "ball-white",
  "ball-blue",
  "pole",
  "hurdle",
  "ring",
  "ladder",
  "mannequin",
  "mini-goal-small",
  "mini-goal-large",
  "pad"
]);

const validZoneColors = new Set<ZoneColor>(["yellow", "red", "blue", "green"]);

const materialLabels: Record<MaterialKind, string> = {
  "ball-orange": "Ball (orange)",
  "ball-white": "Ball (weiß)",
  "ball-blue": "Ball (blau)",
  pole: "Pylon",
  hurdle: "Hürde",
  ring: "Reifen",
  ladder: "Koordinationsleiter",
  mannequin: "Mannequin",
  "mini-goal-small": "Mini-Tor (klein)",
  "mini-goal-large": "Mini-Tor (groß)",
  pad: "Pad"
};

const zoneColorStyles: Record<
  ZoneColor,
  { stroke: string; fill: string; hatch: string }
> = {
  yellow: {
    stroke: "#ca8a04",
    fill: "rgba(250, 204, 21, 0.18)",
    hatch: "#facc15"
  },
  red: {
    stroke: "#b91c1c",
    fill: "rgba(248, 113, 113, 0.18)",
    hatch: "#f87171"
  },
  blue: {
    stroke: "#1d4ed8",
    fill: "rgba(96, 165, 250, 0.18)",
    hatch: "#60a5fa"
  },
  green: {
    stroke: "#15803d",
    fill: "rgba(74, 222, 128, 0.18)",
    hatch: "#4ade80"
  }
};

const zoneColorLabels: Record<ZoneColor, string> = {
  yellow: "Gelb",
  red: "Rot",
  blue: "Blau",
  green: "Grün"
};

const HISTORY_LIMIT = 50;
const ANIMATION_SECONDS_PER_SCENE = 1.6;

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

// Sample a polyline at parameter t in [0,1] using arc-length parameterisation.
// `points` must include start and end (so animator passes [start, ...path, end]).
function samplePolyline(points: PathPoint[], t: number): PathPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length === 1) {
    return points[0];
  }

  const segLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    total += len;
  }

  if (total === 0) {
    return points[0];
  }

  const target = Math.min(1, Math.max(0, t)) * total;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i += 1) {
    if (acc + segLengths[i] >= target) {
      const local = segLengths[i] === 0 ? 0 : (target - acc) / segLengths[i];
      const a = points[i];
      const b = points[i + 1];
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local
      };
    }
    acc += segLengths[i];
  }

  return points[points.length - 1];
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

    const candidate = item as Partial<BoardElement> & { type?: string };
    if (
      !candidate.id ||
      !candidate.type ||
      typeof candidate.x !== "number" ||
      typeof candidate.y !== "number"
    ) {
      return [];
    }

    // Legacy "text" notes are dropped silently on load.
    const rawType = candidate.type as string;
    if (rawType === "text") {
      return [];
    }

    if (!validTypes.has(rawType as BoardElementType)) {
      return [];
    }

    const type = rawType as BoardElementType;

    const arrowKind =
      candidate.arrowKind && validArrowKinds.has(candidate.arrowKind)
        ? candidate.arrowKind
        : type === "arrow"
          ? "run" // legacy arrows default to dashed run paths
          : undefined;

    const materialKind =
      candidate.materialKind && validMaterialKinds.has(candidate.materialKind)
        ? candidate.materialKind
        : type === "material"
          ? "ball-orange"
          : undefined;

    const zoneColor =
      candidate.zoneColor && validZoneColors.has(candidate.zoneColor)
        ? candidate.zoneColor
        : type === "zone"
          ? "yellow"
          : undefined;

    return [
      {
        id: candidate.id,
        type,
        label: candidate.label ?? "",
        name: candidate.name,
        playerId: candidate.playerId,
        position: candidate.position,
        x: candidate.x,
        y: candidate.y,
        x2: typeof candidate.x2 === "number" ? candidate.x2 : undefined,
        y2: typeof candidate.y2 === "number" ? candidate.y2 : undefined,
        width:
          typeof candidate.width === "number"
            ? candidate.width
            : type === "zone"
              ? 24
              : undefined,
        height:
          typeof candidate.height === "number"
            ? candidate.height
            : type === "zone"
              ? 18
              : undefined,
        color: candidate.color,
        arrowKind,
        materialKind,
        zoneColor,
        rotation:
          typeof candidate.rotation === "number"
            ? ((Math.round(candidate.rotation / 90) * 90) % 360 + 360) % 360
            : 0,
        path: Array.isArray(candidate.path)
          ? candidate.path.flatMap((point): PathPoint[] => {
              if (
                isRecord(point) &&
                typeof point.x === "number" &&
                typeof point.y === "number"
              ) {
                return [{ x: point.x, y: point.y }];
              }
              return [];
            })
          : undefined
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
      return { version: 3, scenes };
    }
  }

  return {
    version: 3,
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

  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

interface MaterialIconSize {
  width: number;
  height: number;
}

const materialIconSizes: Record<MaterialKind, MaterialIconSize> = {
  "ball-orange": { width: 18, height: 18 },
  "ball-white": { width: 18, height: 18 },
  "ball-blue": { width: 18, height: 18 },
  pole: { width: 10, height: 32 },
  hurdle: { width: 28, height: 18 },
  ring: { width: 22, height: 22 },
  ladder: { width: 44, height: 18 },
  mannequin: { width: 16, height: 36 },
  "mini-goal-small": { width: 32, height: 16 },
  "mini-goal-large": { width: 48, height: 22 },
  pad: { width: 26, height: 18 }
};

function MaterialIcon({
  kind,
  size = 1
}: {
  kind: MaterialKind;
  size?: number;
}) {
  const dim = materialIconSizes[kind];
  const w = dim.width * size;
  const h = dim.height * size;

  if (kind === "ball-orange" || kind === "ball-white" || kind === "ball-blue") {
    const fill =
      kind === "ball-orange"
        ? "#f97316"
        : kind === "ball-blue"
          ? "#3b82f6"
          : "#ffffff";
    return (
      <svg height={h} viewBox="0 0 18 18" width={w}>
        <circle cx="9" cy="9" fill={fill} r="8" stroke="#0f172a" strokeWidth="1" />
        <path
          d="M9 1 L11 6 L16 7 L12 11 L13 16 L9 13 L5 16 L6 11 L2 7 L7 6 Z"
          fill={kind === "ball-white" ? "#0f172a" : "#0f172a"}
          opacity="0.45"
          transform="scale(0.55) translate(7 7)"
        />
      </svg>
    );
  }

  if (kind === "pole") {
    return (
      <svg height={h} viewBox="0 0 10 32" width={w}>
        <rect fill="#dc2626" height="28" rx="1" width="3" x="3.5" y="2" />
        <ellipse cx="5" cy="30" fill="#7f1d1d" rx="4" ry="1.5" />
      </svg>
    );
  }

  if (kind === "hurdle") {
    return (
      <svg height={h} viewBox="0 0 28 18" width={w}>
        <rect fill="#dc2626" height="2" width="24" x="2" y="6" />
        <rect fill="#7f1d1d" height="10" width="2" x="2" y="6" />
        <rect fill="#7f1d1d" height="10" width="2" x="24" y="6" />
        <rect fill="#0f172a" height="2" width="28" y="16" />
      </svg>
    );
  }

  if (kind === "ring") {
    return (
      <svg height={h} viewBox="0 0 22 22" width={w}>
        <circle cx="11" cy="11" fill="none" r="9" stroke="#f59e0b" strokeWidth="3" />
      </svg>
    );
  }

  if (kind === "ladder") {
    return (
      <svg height={h} viewBox="0 0 44 18" width={w}>
        <rect fill="#fbbf24" height="2" width="44" y="2" />
        <rect fill="#fbbf24" height="2" width="44" y="14" />
        {[6, 14, 22, 30, 38].map((x) => (
          <rect fill="#fbbf24" height="10" key={x} width="2" x={x} y="4" />
        ))}
      </svg>
    );
  }

  if (kind === "mannequin") {
    return (
      <svg height={h} viewBox="0 0 16 36" width={w}>
        <circle cx="8" cy="5" fill="#1e3a8a" r="3.5" />
        <rect fill="#1e3a8a" height="18" rx="2" width="8" x="4" y="9" />
        <rect fill="#1e3a8a" height="6" width="3" x="4" y="27" />
        <rect fill="#1e3a8a" height="6" width="3" x="9" y="27" />
        <ellipse cx="8" cy="34" fill="#0f172a" rx="6" ry="1.5" />
      </svg>
    );
  }

  if (kind === "mini-goal-small") {
    return (
      <svg height={h} viewBox="0 0 32 16" width={w}>
        <rect fill="rgba(255,255,255,0.4)" height="10" width="28" x="2" y="2" />
        <path
          d="M2 2 V12 H30 V2"
          fill="none"
          stroke="#f8fafc"
          strokeWidth="1.5"
        />
        <path
          d="M2 12 L6 14 H26 L30 12"
          fill="#94a3b8"
          stroke="#0f172a"
          strokeWidth="0.5"
        />
      </svg>
    );
  }

  if (kind === "mini-goal-large") {
    return (
      <svg height={h} viewBox="0 0 48 22" width={w}>
        <rect fill="rgba(255,255,255,0.4)" height="14" width="42" x="3" y="3" />
        <path
          d="M3 3 V17 H45 V3"
          fill="none"
          stroke="#f8fafc"
          strokeWidth="1.8"
        />
        {[12, 21, 30, 39].map((x) => (
          <line
            key={x}
            stroke="#f8fafc"
            strokeWidth="0.6"
            x1={x}
            x2={x}
            y1="3"
            y2="17"
          />
        ))}
        <path
          d="M3 17 L8 20 H40 L45 17"
          fill="#94a3b8"
          stroke="#0f172a"
          strokeWidth="0.6"
        />
      </svg>
    );
  }

  if (kind === "pad") {
    return (
      <svg height={h} viewBox="0 0 26 18" width={w}>
        <rect fill="#1e40af" height="14" rx="2" width="22" x="2" y="2" />
        <rect fill="#3b82f6" height="6" width="22" x="2" y="2" />
        <line stroke="#0f172a" strokeWidth="0.5" x1="2" x2="24" y1="9" y2="9" />
      </svg>
    );
  }

  return null;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pathDrawingFor, setPathDrawingFor] = useState<string | null>(null);

  const activeScene =
    boardState.scenes.find((scene) => scene.id === activeSceneId) ??
    boardState.scenes[0];
  const elements = useMemo(
    () => activeScene?.elements ?? [],
    [activeScene]
  );
  const arrowElements = useMemo(
    () => elements.filter((item) => item.type === "arrow"),
    [elements]
  );
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

      const isRotate =
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.toLowerCase() === "r";

      const isDeselect = event.key === "Escape";

      if (isUndo) {
        event.preventDefault();
        undo();
      } else if (isRedo) {
        event.preventDefault();
        redo();
      } else if (isRotate && selectedId) {
        event.preventDefault();
        rotateSelected(event.shiftKey ? "ccw" : "cw");
      } else if (isDeselect) {
        setSelectedId(null);
        setPathDrawingFor(null);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, selectedId]);

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
          : type === "arrow"
            ? arrowKindLabels[arrowKind ?? "run"]
            : "";

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

  function addMaterial(kind: MaterialKind) {
    setActiveElements((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "material",
        label: "",
        x: maybeSnap(48),
        y: maybeSnap(50),
        materialKind: kind
      }
    ]);
  }

  function addZone(color: ZoneColor) {
    setActiveElements((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type: "zone",
        label: "",
        x: maybeSnap(38),
        y: maybeSnap(40),
        width: 24,
        height: 18,
        zoneColor: color
      }
    ]);
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

        if (dragTarget.point === "resize" && item.type === "zone") {
          const width = Math.max(4, snapX(point.x) - item.x);
          const height = Math.max(4, snapY(point.y) - item.y);
          return { ...item, width, height };
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

        if (item.type === "zone") {
          return { ...item, x, y };
        }

        return { ...item, x, y };
      })
    );
  }

  function endDrag() {
    if (dragTarget && dragSnapshotRef.current) {
      const snapshot = dragSnapshotRef.current;
      const dragId = dragTarget.id;
      const dragPoint = dragTarget.point;
      setBoardState((current) => {
        if (current !== snapshot) {
          pushHistory(snapshot);
        } else if (dragPoint === "body") {
          // No movement → treat as select.
          setSelectedId(dragId);
        }
        return current;
      });
    }
    dragSnapshotRef.current = null;
    setDragTarget(null);
  }

  function deleteElement(id: string) {
    if (selectedId === id) setSelectedId(null);
    setActiveElements((current) => current.filter((item) => item.id !== id));
  }

  function rotateSelected(direction: "cw" | "ccw") {
    if (!selectedId) return;
    setActiveElements((current) =>
      current.map((item) => {
        if (item.id !== selectedId) return item;
        const currentRotation = item.rotation ?? 0;
        const next = direction === "cw" ? currentRotation + 90 : currentRotation - 90;
        return { ...item, rotation: ((next % 360) + 360) % 360 };
      })
    );
  }

  function appendWaypoint(elementId: string, point: PathPoint) {
    setActiveElements((current) =>
      current.map((item) =>
        item.id === elementId
          ? {
              ...item,
              path: [...(item.path ?? []), point]
            }
          : item
      )
    );
  }

  function moveWaypoint(elementId: string, index: number, point: PathPoint) {
    setActiveElements((current) =>
      current.map((item) => {
        if (item.id !== elementId || !item.path) return item;
        const next = item.path.map((p, i) => (i === index ? point : p));
        return { ...item, path: next };
      })
    );
  }

  function removeWaypoint(elementId: string, index: number) {
    setActiveElements((current) =>
      current.map((item) => {
        if (item.id !== elementId || !item.path) return item;
        const next = item.path.filter((_, i) => i !== index);
        return { ...item, path: next.length > 0 ? next : undefined };
      })
    );
  }

  function clearPath(elementId: string) {
    setActiveElements((current) =>
      current.map((item) =>
        item.id === elementId ? { ...item, path: undefined } : item
      )
    );
  }

  function resetBoard() {
    commit(() => initialBoardState);
    setActiveSceneId(initialBoardState.scenes[0]?.id ?? "scene-1");
  }

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // ---------- Animation (Stufe 1: Keyframe-Interpolation) ----------
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const sceneCount = boardState.scenes.length;
  const segmentCount = Math.max(0, sceneCount - 1);
  const totalDuration = segmentCount * ANIMATION_SECONDS_PER_SCENE;
  const canPlay = segmentCount >= 1;

  // Easing — easeInOutQuad
  const ease = (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const isAnimating = (isPlaying || playbackTime > 0) && segmentCount > 0;

  // Compute interpolated elements for the current playbackTime.
  const animatedElements = useMemo<BoardElement[]>(() => {
    if (segmentCount === 0) {
      return elements;
    }

    const clamped = Math.min(
      Math.max(playbackTime, 0),
      totalDuration - 0.0001
    );
    const segmentIndex = Math.min(
      segmentCount - 1,
      Math.floor(clamped / ANIMATION_SECONDS_PER_SCENE)
    );
    const tRaw =
      (clamped - segmentIndex * ANIMATION_SECONDS_PER_SCENE) /
      ANIMATION_SECONDS_PER_SCENE;
    const t = ease(Math.min(1, Math.max(0, tRaw)));

    const sceneA = boardState.scenes[segmentIndex];
    const sceneB = boardState.scenes[segmentIndex + 1];

    if (!sceneA || !sceneB) {
      return sceneA?.elements ?? sceneB?.elements ?? [];
    }

    const matchKey = (el: BoardElement) =>
      el.playerId ? `pid:${el.playerId}` : `id:${el.id}`;

    const indexB = new Map<string, BoardElement>();
    for (const el of sceneB.elements) {
      indexB.set(matchKey(el), el);
    }

    const usedB = new Set<string>();

    const lerp = (a: number, b: number) => a + (b - a) * t;
    const lerpOptional = (a?: number, b?: number) => {
      if (typeof a !== "number" && typeof b !== "number") return undefined;
      if (typeof a !== "number") return b;
      if (typeof b !== "number") return a;
      return lerp(a, b);
    };

    const blended: BoardElement[] = [];

    for (const el of sceneA.elements) {
      const match = indexB.get(matchKey(el));
      if (match) {
        usedB.add(matchKey(el));

        // Stage 2: if the element has a path defined in scene A, follow it.
        // Path waypoints are intermediate; full polyline is [start, ...path, end].
        if (el.path && el.path.length > 0) {
          const polyline: PathPoint[] = [
            { x: el.x, y: el.y },
            ...el.path,
            { x: match.x, y: match.y }
          ];
          const sampled = samplePolyline(polyline, t);
          blended.push({
            ...el,
            x: sampled.x,
            y: sampled.y,
            x2: lerpOptional(el.x2, match.x2),
            y2: lerpOptional(el.y2, match.y2),
            width: lerpOptional(el.width, match.width),
            height: lerpOptional(el.height, match.height),
            // Hide path on animated copy so we don't render it during playback.
            path: undefined
          });
        } else {
          blended.push({
            ...el,
            x: lerp(el.x, match.x),
            y: lerp(el.y, match.y),
            x2: lerpOptional(el.x2, match.x2),
            y2: lerpOptional(el.y2, match.y2),
            width: lerpOptional(el.width, match.width),
            height: lerpOptional(el.height, match.height)
          });
        }
      } else {
        // Element in A only → fade out (kept fully visible, simpler render).
        blended.push(el);
      }
    }

    for (const el of sceneB.elements) {
      if (!usedB.has(matchKey(el))) {
        // Element introduced in B — show at its B position once t > 0.5.
        if (t > 0.5) blended.push(el);
      }
    }

    return blended;
  }, [
    segmentCount,
    playbackTime,
    totalDuration,
    boardState.scenes,
    elements
  ]);

  function stopPlayback() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = null;
    setIsPlaying(false);
    setPlaybackTime(0);
    playbackTimeRef.current = 0;
  }

  function pausePlayback() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = null;
    setIsPlaying(false);
  }

  function startPlayback() {
    if (!canPlay) return;
    if (playbackTimeRef.current >= totalDuration) {
      playbackTimeRef.current = 0;
      setPlaybackTime(0);
    }
    setIsPlaying(true);
  }

  // RAF loop driven by isPlaying.
  useEffect(() => {
    if (!isPlaying) return;

    function tick(now: number) {
      const last = lastTickRef.current ?? now;
      const dt = ((now - last) / 1000) * playbackSpeed;
      lastTickRef.current = now;

      const next = playbackTimeRef.current + dt;
      if (next >= totalDuration) {
        playbackTimeRef.current = totalDuration;
        setPlaybackTime(totalDuration);
        setIsPlaying(false);
        rafRef.current = null;
        lastTickRef.current = null;
        // Snap view to final scene.
        const finalScene = boardState.scenes[boardState.scenes.length - 1];
        if (finalScene) {
          queueMicrotask(() => setActiveSceneId(finalScene.id));
        }
        return;
      }

      playbackTimeRef.current = next;
      setPlaybackTime(next);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTickRef.current = null;
    };
  }, [isPlaying, playbackSpeed, totalDuration, boardState.scenes]);

  // Stop playback if user mutates while playing.
  useEffect(() => {
    if (dragTarget && isPlaying) {
      pausePlayback();
    }
  }, [dragTarget, isPlaying]);

  const renderElements = isAnimating ? animatedElements : elements;
  const renderArrows = renderElements.filter((item) => item.type === "arrow");
  const renderZones = renderElements.filter((item) => item.type === "zone");
  const renderBodies = renderElements.filter(
    (item) => item.type !== "arrow" && item.type !== "zone"
  );

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

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 no-print">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Animation
        </span>
        {!isPlaying ? (
          <Button
            disabled={!canPlay}
            onClick={startPlayback}
            size="sm"
            title={
              canPlay
                ? "Szenen-Animation abspielen"
                : "Erstelle mindestens 2 Szenen"
            }
            type="button"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            Abspielen
          </Button>
        ) : (
          <Button onClick={pausePlayback} size="sm" type="button" variant="secondary">
            <Pause aria-hidden="true" className="h-4 w-4" />
            Pause
          </Button>
        )}
        <Button
          disabled={!canPlay && playbackTime === 0}
          onClick={stopPlayback}
          size="sm"
          type="button"
          variant="outline"
        >
          <Square aria-hidden="true" className="h-4 w-4" />
          Stop
        </Button>

        <div className="flex items-center gap-1 rounded-md border border-border bg-white p-0.5">
          {[0.5, 1, 2].map((speed) => (
            <button
              className={cn(
                "h-7 rounded px-2 text-xs font-medium transition",
                playbackSpeed === speed
                  ? "bg-slate-950 text-white"
                  : "text-foreground hover:bg-secondary"
              )}
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              type="button"
            >
              {speed}×
            </button>
          ))}
        </div>

        <input
          aria-label="Animations-Position"
          className="ml-1 min-w-[140px] flex-1 accent-slate-950"
          disabled={!canPlay}
          max={Math.max(0.0001, totalDuration)}
          min={0}
          onChange={(event) => {
            const next = Number(event.target.value);
            playbackTimeRef.current = next;
            setPlaybackTime(next);
            if (!isPlaying) {
              // Trigger one-frame interpolation by briefly toggling playing flag.
              // Easiest: directly compute via animatedElements memo —
              // achieved by marking isPlaying true for a tick is too invasive,
              // so we simply leave this as scrub-when-paused via state update.
            }
          }}
          step={0.01}
          type="range"
          value={Math.min(playbackTime, totalDuration)}
        />
        <span className="min-w-[58px] text-right font-mono text-xs text-muted-foreground">
          {playbackTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
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
            <p className="text-sm font-semibold">Material</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(materialLabels) as MaterialKind[]).map((kind) => (
                <button
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-white p-1 transition hover:border-foreground/40"
                  key={kind}
                  onClick={() => addMaterial(kind)}
                  title={materialLabels[kind]}
                  type="button"
                >
                  <MaterialIcon kind={kind} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-semibold">Zonen</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(zoneColorStyles) as ZoneColor[]).map((color) => {
                const style = zoneColorStyles[color];
                return (
                  <button
                    className="flex h-9 items-center justify-center rounded-md border-2 transition hover:scale-105"
                    key={color}
                    onClick={() => addZone(color)}
                    style={{
                      borderColor: style.stroke,
                      background: `repeating-linear-gradient(45deg, ${style.hatch}55 0 4px, transparent 4px 8px)`
                    }}
                    title={`Zone ${zoneColorLabels[color]}`}
                    type="button"
                  />
                );
              })}
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Zone hinzufügen, dann am rechten unteren Eck-Punkt skalieren.
            </p>
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

            <span className="mx-1 hidden h-6 w-px self-center bg-border sm:block" />

            <Button
              disabled={!selectedId}
              onClick={() => rotateSelected("ccw")}
              size="sm"
              title="Selektiertes Element gegen den Uhrzeigersinn drehen (Shift+R)"
              type="button"
              variant="outline"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              90° ↺
            </Button>
            <Button
              disabled={!selectedId}
              onClick={() => rotateSelected("cw")}
              size="sm"
              title="Selektiertes Element im Uhrzeigersinn drehen (R)"
              type="button"
              variant="outline"
            >
              <RotateCw aria-hidden="true" className="h-4 w-4" />
              90° ↻
            </Button>

            {(() => {
              const selected = elements.find((el) => el.id === selectedId);
              const canHavePath =
                selected &&
                (selected.type === "player" ||
                  selected.type === "opponent" ||
                  selected.type === "ball" ||
                  selected.type === "material");
              if (!canHavePath) return null;
              const isDrawing = pathDrawingFor === selected.id;
              const hasPath = (selected.path?.length ?? 0) > 0;
              return (
                <>
                  <span className="mx-1 hidden h-6 w-px self-center bg-border sm:block" />
                  <Button
                    onClick={() =>
                      setPathDrawingFor(isDrawing ? null : selected.id)
                    }
                    size="sm"
                    title="Klicke aufs Feld, um Wegpunkte zu setzen. Esc beendet."
                    type="button"
                    variant={isDrawing ? "default" : "outline"}
                  >
                    {isDrawing ? "Pfad fertig" : "Pfad zeichnen"}
                  </Button>
                  {hasPath ? (
                    <Button
                      onClick={() => clearPath(selected.id)}
                      size="sm"
                      title="Pfad löschen"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Pfad
                    </Button>
                  ) : null}
                </>
              );
            })()}

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
            className={cn(
              "relative aspect-[1.55] min-h-[420px] overflow-hidden rounded-2xl border-4 border-emerald-950/10 bg-emerald-700 shadow-inner [print-color-adjust:exact]",
              pathDrawingFor && "cursor-crosshair"
            )}
            id={`field-${board.id}`}
            onClick={(event) => {
              if (pathDrawingFor) {
                const point = fieldPoint(event.clientX, event.clientY);
                if (point) {
                  appendWaypoint(pathDrawingFor, {
                    x: maybeSnap(point.x),
                    y: maybeSnap(point.y)
                  });
                }
                return;
              }
              // Click on bare field deselects.
              if (event.target === event.currentTarget) {
                setSelectedId(null);
              }
            }}
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

            {renderZones.map((item) => {
              const color = item.zoneColor ?? "yellow";
              const style = zoneColorStyles[color];
              const w = item.width ?? 24;
              const h = item.height ?? 18;
              return (
                <div
                  className="pointer-events-none absolute rounded-md border-2 [print-color-adjust:exact]"
                  key={item.id}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${w}%`,
                    height: `${h}%`,
                    borderColor: style.stroke,
                    background: `repeating-linear-gradient(45deg, ${style.hatch}66 0 6px, transparent 6px 12px)`
                  }}
                />
              );
            })}

            {!isAnimating &&
              renderZones.map((item) => {
                const w = item.width ?? 24;
                const h = item.height ?? 18;
                return (
                  <div className="no-print" key={`${item.id}-zone-handles`}>
                    <button
                      aria-label="Zone verschieben"
                      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border border-white bg-slate-950/80 text-white shadow"
                      onPointerDown={(event) =>
                        startDrag(event, { id: item.id, point: "body" }, item)
                      }
                      onDoubleClick={() => deleteElement(item.id)}
                      style={{
                        left: `${item.x + w / 2}%`,
                        top: `${item.y + h / 2}%`
                      }}
                      title="Zone verschieben — Doppelklick löscht"
                      type="button"
                    >
                      <Move aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label="Zone skalieren"
                      className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-sm border-2 border-slate-950 bg-white shadow"
                      onPointerDown={(event) =>
                        startDrag(event, { id: item.id, point: "resize" }, item)
                      }
                      style={{ left: `${item.x + w}%`, top: `${item.y + h}%` }}
                      title="Zone skalieren"
                      type="button"
                    />
                  </div>
                );
              })}

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
              {renderArrows.map((item) => {
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
              {!isAnimating &&
                elements
                  .filter((item) => (item.path?.length ?? 0) > 0)
                  .flatMap((item) => {
                    const polyline: PathPoint[] = [
                      { x: item.x, y: item.y },
                      ...(item.path ?? [])
                    ];
                    const segments = [];
                    for (let i = 1; i < polyline.length; i += 1) {
                      segments.push(
                        <line
                          key={`${item.id}-path-${i}`}
                          stroke="#38bdf8"
                          strokeDasharray="6 4"
                          strokeLinecap="round"
                          strokeWidth="2"
                          x1={`${polyline[i - 1].x}%`}
                          x2={`${polyline[i].x}%`}
                          y1={`${polyline[i - 1].y}%`}
                          y2={`${polyline[i].y}%`}
                        />
                      );
                    }
                    return segments;
                  })}
            </svg>

            {!isAnimating &&
              elements
                .filter((item) => (item.path?.length ?? 0) > 0)
                .flatMap((item) =>
                  (item.path ?? []).map((point, index) => (
                    <button
                      aria-label={`Wegpunkt ${index + 1} verschieben`}
                      className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-sky-500 shadow"
                      key={`${item.id}-wp-${index}`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        const start = fieldPoint(event.clientX, event.clientY);
                        if (!start) return;
                        // Live drag without history per move; commit happens via state diff.
                        const move = (e: globalThis.PointerEvent) => {
                          const p = fieldPoint(e.clientX, e.clientY);
                          if (!p) return;
                          moveWaypoint(item.id, index, {
                            x: maybeSnap(p.x),
                            y: maybeSnap(p.y)
                          });
                        };
                        const up = () => {
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", up);
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", up);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        removeWaypoint(item.id, index);
                      }}
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                      title={`Wegpunkt ${index + 1} — Doppelklick löscht`}
                      type="button"
                    />
                  ))
                )}

            {!isAnimating && arrowElements.map((item) => {
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

            {renderBodies.map((item) => {
              const isSelected = selectedId === item.id && !isAnimating;
              const rotation = item.rotation ?? 0;

              if (item.type === "cone") {
                return (
                  <button
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 touch-none [print-color-adjust:exact]",
                      isSelected && "rounded-full ring-2 ring-sky-400 ring-offset-1"
                    )}
                    key={item.id}
                    onPointerDown={
                      isAnimating
                        ? undefined
                        : (event) =>
                            startDrag(
                              event,
                              { id: item.id, point: "body" },
                              item
                            )
                    }
                    onDoubleClick={() =>
                      isAnimating ? undefined : deleteElement(item.id)
                    }
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    title="Hütchen — Klick selektiert, Doppelklick löscht"
                    type="button"
                  >
                    <svg
                      height="14"
                      style={{ transform: `rotate(${rotation}deg)` }}
                      viewBox="0 0 14 14"
                      width="14"
                    >
                      <polygon
                        fill="#f97316"
                        points="7,1 13,13 1,13"
                        stroke="#7c2d12"
                        strokeLinejoin="round"
                        strokeWidth="1"
                      />
                    </svg>
                  </button>
                );
              }

              if (item.type === "material" && item.materialKind) {
                return (
                  <button
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 touch-none drop-shadow [print-color-adjust:exact]",
                      isSelected && "rounded-md ring-2 ring-sky-400 ring-offset-1"
                    )}
                    key={item.id}
                    onPointerDown={
                      isAnimating
                        ? undefined
                        : (event) =>
                            startDrag(
                              event,
                              { id: item.id, point: "body" },
                              item
                            )
                    }
                    onDoubleClick={() =>
                      isAnimating ? undefined : deleteElement(item.id)
                    }
                    style={{ left: `${item.x}%`, top: `${item.y}%` }}
                    title={`${materialLabels[item.materialKind]} — Klick selektiert, Doppelklick löscht`}
                    type="button"
                  >
                    <span
                      className="block"
                      style={{ transform: `rotate(${rotation}deg)` }}
                    >
                      <MaterialIcon kind={item.materialKind} size={1.4} />
                    </span>
                  </button>
                );
              }

              return (
                <button
                  className={cn(
                    "absolute flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border px-2 text-xs font-semibold shadow-lg transition hover:scale-105 [print-color-adjust:exact]",
                    elementClass(item.type),
                    isSelected && "ring-2 ring-sky-400 ring-offset-1"
                  )}
                  key={item.id}
                  onPointerDown={
                    isAnimating
                      ? undefined
                      : (event) =>
                          startDrag(event, { id: item.id, point: "body" }, item)
                  }
                  onDoubleClick={() =>
                    isAnimating ? undefined : deleteElement(item.id)
                  }
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  title={`${item.name ?? item.label} — Doppelklick löscht`}
                  type="button"
                >
                  {item.type === "ball" ? "●" : item.label}
                  {item.type === "player" && item.name ? (
                    <span className={playerLabelClass(item.y)}>
                      {shortName(item.name)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
