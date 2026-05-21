"use client";

import { useRef, useState } from "react";
import { MousePointer2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updatePhaseDiagram } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { Button } from "@/components/ui/button";
import {
  VIEWBOX_W,
  VIEWBOX_H,
  FIELD,
  lx,
  ly,
  FieldMarkings,
  TEAM_COLORS,
  ZONE_COLORS,
  MOVEMENT_COLORS,
  type DiagramPlayer,
  type DiagramMovement,
  type DiagramZone,
  type DiagramGoal,
  type DiagramCone,
  type DiagramMannequin,
  type DiagramBall,
  type PhaseDiagram,
} from "@/components/training-phase-diagram";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool =
  | "select"
  | "playerA" | "playerB" | "neutral"
  | "pass" | "run" | "shot" | "dribble"
  | "zone"
  | "goal_big" | "goal_mini"
  | "cone" | "mannequin" | "ball"
  | "delete";

interface ZoneDraft { x1: number; y1: number; x2: number; y2: number }

interface Snapshot {
  players: DiagramPlayer[];
  movements: DiagramMovement[];
  zones: DiagramZone[];
  goals: DiagramGoal[];
  cones: DiagramCone[];
  mannequins: DiagramMannequin[];
  balls: DiagramBall[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function getDataCoords(
  e: { clientX: number; clientY: number },
  svgEl: SVGSVGElement
) {
  const rect = svgEl.getBoundingClientRect();
  const svgX = ((e.clientX - rect.left) / rect.width) * VIEWBOX_W;
  const svgY = ((e.clientY - rect.top) / rect.height) * VIEWBOX_H;
  return {
    dx: clamp(((svgX - FIELD.x) / FIELD.w) * 100, 0, 100),
    dy: clamp(((svgY - FIELD.y) / FIELD.h) * 100, 0, 100),
  };
}

function arrowMarker(id: string, color: string) {
  return (
    <marker id={id} key={id} markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
      <path d="M0,0 L0,6 L6,3 z" fill={color} />
    </marker>
  );
}

const CONE_COLORS: { label: string; value: DiagramCone["color"]; fill: string }[] = [
  { label: "Orange", value: "orange", fill: "#f97316" },
  { label: "Rot",    value: "red",    fill: "#ef4444" },
  { label: "Gelb",   value: "yellow", fill: "#fbbf24" },
  { label: "Blau",   value: "blue",   fill: "#3b82f6" },
];

const CONE_FILL: Record<string, string> = {
  orange: "#f97316", red: "#ef4444", yellow: "#fbbf24", blue: "#3b82f6",
};
const CONE_STROKE: Record<string, string> = {
  orange: "#ea580c", red: "#b91c1c", yellow: "#d97706", blue: "#1d4ed8",
};

const MAX_HISTORY = 30;

// ─── Component ────────────────────────────────────────────────────────────────

interface TacticBoardDrawerProps {
  existingDiagram?: PhaseDiagram | null;
  isOpen: boolean;
  onClose: () => void;
  phaseId: string;
}

export function TacticBoardDrawer({
  existingDiagram,
  isOpen,
  onClose,
  phaseId,
}: TacticBoardDrawerProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const [field, setField] = useState<PhaseDiagram["field"]>(existingDiagram?.field ?? "half");
  const [players,    setPlayers]    = useState<DiagramPlayer[]>(existingDiagram?.players ?? []);
  const [movements,  setMovements]  = useState<DiagramMovement[]>(existingDiagram?.movements ?? []);
  const [zones,      setZones]      = useState<DiagramZone[]>(existingDiagram?.zones ?? []);
  const [goals,      setGoals]      = useState<DiagramGoal[]>(existingDiagram?.goals ?? []);
  const [cones,      setCones]      = useState<DiagramCone[]>(existingDiagram?.cones ?? []);
  const [mannequins, setMannequins] = useState<DiagramMannequin[]>(existingDiagram?.mannequins ?? []);
  const [balls,      setBalls]      = useState<DiagramBall[]>(existingDiagram?.balls ?? []);

  const [activeTool,  setActiveTool]  = useState<Tool>("playerA");
  const [zoneColor,   setZoneColor]   = useState<DiagramZone["color"]>("blue");
  const [coneColor,   setConeColor]   = useState<DiagramCone["color"]>("orange");
  const [arrowSource, setArrowSource] = useState<DiagramPlayer | null>(null);
  const [mousePos,    setMousePos]    = useState<{ dx: number; dy: number } | null>(null);
  const [zoneDraft,   setZoneDraft]   = useState<ZoneDraft | null>(null);
  const [dragging,    setDragging]    = useState<{ type: "player" | "cone" | "mannequin" | "ball"; id: string } | null>(null);
  const [history,     setHistory]     = useState<Snapshot[]>([]);
  const [isSaving,    setIsSaving]    = useState(false);
  const [poppedId,    setPoppedId]    = useState<string | null>(null);

  // ── History (undo) ───────────────────────────────────────────────────────

  function snapshot(): Snapshot {
    return { players, movements, zones, goals, cones, mannequins, balls };
  }

  function pushHistory() {
    setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), snapshot()]);
  }

  function undo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setPlayers(last.players);
    setMovements(last.movements);
    setZones(last.zones);
    setGoals(last.goals);
    setCones(last.cones);
    setMannequins(last.mannequins);
    setBalls(last.balls);
    setHistory((prev) => prev.slice(0, -1));
    setArrowSource(null);
    setZoneDraft(null);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  function nextLabel(team: "A" | "B" | "neutral") {
    const prefix = team === "A" ? "A" : team === "B" ? "B" : "N";
    const count = players.filter((p) => p.team === team).length;
    return `${prefix}${count + 1}`;
  }

  function pop(id: string) {
    setPoppedId(id);
    setTimeout(() => setPoppedId((cur) => (cur === id ? null : cur)), 300);
  }

  function addPlayer(dx: number, dy: number, team: "A" | "B" | "neutral") {
    const id = `p-${Date.now()}`;
    pushHistory();
    setPlayers((prev) => [...prev, { id, team, role: "", label: nextLabel(team), x: dx, y: dy }]);
    pop(id);
  }

  function addMovement(fromId: string, toX: number, toY: number, type: DiagramMovement["type"]) {
    pushHistory();
    setMovements((prev) => [
      ...prev,
      { from: fromId, to_x: toX, to_y: toY, type, sequence: prev.length + 1 },
    ]);
  }

  function addGoal(dx: number, dy: number, type: DiagramGoal["type"]) {
    pushHistory();
    setGoals((prev) => [...prev, { type, label: "", x: dx, y: dy, width: type === "big_goal" ? 14 : 7 }]);
  }

  function addZone(x: number, y: number, w: number, h: number) {
    pushHistory();
    setZones((prev) => [...prev, { label: "", x, y, w, h, color: zoneColor }]);
  }

  function addCone(dx: number, dy: number) {
    const id = `c-${Date.now()}`;
    pushHistory();
    setCones((prev) => [...prev, { id, x: dx, y: dy, color: coneColor }]);
    pop(id);
  }

  function addMannequin(dx: number, dy: number) {
    const id = `m-${Date.now()}`;
    pushHistory();
    setMannequins((prev) => [...prev, { id, x: dx, y: dy }]);
    pop(id);
  }

  function addBall(dx: number, dy: number) {
    const id = `b-${Date.now()}`;
    pushHistory();
    setBalls((prev) => [...prev, { id, x: dx, y: dy }]);
    pop(id);
  }

  function removePlayer(id: string) {
    pushHistory();
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setMovements((prev) => prev.filter((m) => m.from !== id));
    if (arrowSource?.id === id) setArrowSource(null);
  }

  function clearAll() {
    pushHistory();
    setPlayers([]); setMovements([]); setZones([]); setGoals([]);
    setCones([]); setMannequins([]); setBalls([]);
    setArrowSource(null); setZoneDraft(null);
  }

  // ── SVG interaction ──────────────────────────────────────────────────────

  function coords(e: { clientX: number; clientY: number }) {
    return svgRef.current ? getDataCoords(e, svgRef.current) : { dx: 0, dy: 0 };
  }

  function handleSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (activeTool !== "zone") return;
    const { dx, dy } = coords(e);
    setZoneDraft({ x1: dx, y1: dy, x2: dx, y2: dy });
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const { dx, dy } = coords(e);
    setMousePos({ dx, dy });
    if (dragging) {
      const { dx: ddx, dy: ddy } = coords(e);
      if (dragging.type === "player") {
        setPlayers((prev) => prev.map((p) => p.id === dragging.id ? { ...p, x: ddx, y: ddy } : p));
      } else if (dragging.type === "cone") {
        setCones((prev) => prev.map((c) => c.id === dragging.id ? { ...c, x: ddx, y: ddy } : c));
      } else if (dragging.type === "mannequin") {
        setMannequins((prev) => prev.map((m) => m.id === dragging.id ? { ...m, x: ddx, y: ddy } : m));
      } else if (dragging.type === "ball") {
        setBalls((prev) => prev.map((b) => b.id === dragging.id ? { ...b, x: ddx, y: ddy } : b));
      }
      return;
    }
    if (activeTool === "zone" && zoneDraft) {
      setZoneDraft((prev) => prev ? { ...prev, x2: dx, y2: dy } : null);
    }
  }

  function handleSvgPointerUp() {
    if (zoneDraft) {
      const x = Math.min(zoneDraft.x1, zoneDraft.x2);
      const y = Math.min(zoneDraft.y1, zoneDraft.y2);
      const w = Math.abs(zoneDraft.x2 - zoneDraft.x1);
      const h = Math.abs(zoneDraft.y2 - zoneDraft.y1);
      if (w > 4 && h > 4) addZone(x, y, w, h);
      setZoneDraft(null);
    }
    if (dragging) {
      setDragging(null);
    }
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const { dx, dy } = coords(e);
    if (activeTool === "playerA")   { addPlayer(dx, dy, "A"); return; }
    if (activeTool === "playerB")   { addPlayer(dx, dy, "B"); return; }
    if (activeTool === "neutral")   { addPlayer(dx, dy, "neutral"); return; }
    if (activeTool === "goal_big")  { addGoal(dx, dy, "big_goal"); return; }
    if (activeTool === "goal_mini") { addGoal(dx, dy, "mini_goal"); return; }
    if (activeTool === "cone")      { addCone(dx, dy); return; }
    if (activeTool === "mannequin") { addMannequin(dx, dy); return; }
    if (activeTool === "ball")      { addBall(dx, dy); return; }

    const isArrow = ["pass","run","shot","dribble"].includes(activeTool);
    if (isArrow && arrowSource) {
      addMovement(arrowSource.id, dx, dy, activeTool as DiagramMovement["type"]);
      setArrowSource(null);
    }
  }

  function handlePlayerPointerDown(e: React.PointerEvent<SVGCircleElement>, player: DiagramPlayer) {
    if (activeTool !== "select") return;
    e.stopPropagation();
    pushHistory();
    setDragging({ type: "player", id: player.id });
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePlayerClick(e: React.MouseEvent, player: DiagramPlayer) {
    e.stopPropagation();
    if (activeTool === "delete") { removePlayer(player.id); return; }
    if (["pass","run","shot","dribble"].includes(activeTool)) {
      setArrowSource((prev) => prev?.id === player.id ? null : player);
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function save() {
    setIsSaving(true);
    try {
      const diagram: PhaseDiagram = { field, players, movements, zones, goals, cones, mannequins, balls };
      const formData = new FormData();
      formData.set("phase_id", phaseId);
      formData.set("diagram", JSON.stringify(diagram));
      await updatePhaseDiagram(formData);
      toast.success("Taktikdiagramm gespeichert");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const FIELD_OPTIONS: { label: string; value: PhaseDiagram["field"] }[] = [
    { label: "Ganzes Feld", value: "full" },
    { label: "Halbes Feld", value: "half" },
    { label: "Sechzehner",  value: "box"  },
  ];

  const MOVE_TOOLS: { label: string; value: Tool; color: string }[] = [
    { label: "Pass",     value: "pass",    color: MOVEMENT_COLORS.pass    },
    { label: "Lauf",     value: "run",     color: MOVEMENT_COLORS.run     },
    { label: "Schuss",   value: "shot",    color: MOVEMENT_COLORS.shot    },
    { label: "Dribbling",value: "dribble", color: MOVEMENT_COLORS.dribble },
  ];

  const ZONE_COLORS_LIST: { label: string; value: DiagramZone["color"]; fill: string }[] = [
    { label: "Blau",   value: "blue",   fill: "#3b82f6" },
    { label: "Rot",    value: "red",    fill: "#ef4444" },
    { label: "Orange", value: "orange", fill: "#f97316" },
    { label: "Grün",   value: "green",  fill: "#22c55e" },
  ];

  const isArrowTool = ["pass","run","shot","dribble"].includes(activeTool);

  const draftRect = zoneDraft ? {
    x: lx(Math.min(zoneDraft.x1, zoneDraft.x2)),
    y: ly(Math.min(zoneDraft.y1, zoneDraft.y2)),
    w: (Math.abs(zoneDraft.x2 - zoneDraft.x1) / 100) * FIELD.w,
    h: (Math.abs(zoneDraft.y2 - zoneDraft.y1) / 100) * FIELD.h,
  } : null;

  function toolBtn(t: Tool, label: React.ReactNode, danger = false) {
    const active = activeTool === t;
    return (
      <button
        className={`flex h-7 items-center justify-center rounded-md border px-2 text-[10px] font-medium transition-colors ${
          active
            ? danger ? "border-red-500 bg-red-500 text-white" : "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background hover:bg-secondary"
        }`}
        onClick={() => { setActiveTool(t); setArrowSource(null); }}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <SideDrawer eyebrow="Phase" isOpen={isOpen} onClose={onClose} title="Taktikboard">
      <div className="flex flex-col gap-3">

        {/* Field selector */}
        <div className="flex gap-1">
          {FIELD_OPTIONS.map((opt) => (
            <button
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                field === opt.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
              key={opt.value}
              onClick={() => setField(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-2">
          {/* Players */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">Spieler</span>
            {(["playerA","playerB","neutral"] as const).map((t) => {
              const team = t === "playerA" ? "A" : t === "playerB" ? "B" : "neutral";
              const c = TEAM_COLORS[team];
              return (
                <button
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white transition ${
                    activeTool === t ? "scale-110 border-primary shadow" : "border-transparent"
                  }`}
                  key={t}
                  onClick={() => { setActiveTool(t); setArrowSource(null); }}
                  style={{ backgroundColor: c.fill }}
                  title={`Team ${team}`}
                  type="button"
                >
                  {team === "A" ? "A" : team === "B" ? "B" : "N"}
                </button>
              );
            })}
          </div>

          {/* Objects */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">Objekte</span>
            {toolBtn("cone",      "🔺 Hütchen")}
            {toolBtn("mannequin", "🕴 Dummy")}
            {toolBtn("ball",      "⚽ Ball")}
            {activeTool === "cone" && (
              <div className="ml-1 flex gap-1">
                {CONE_COLORS.map((c) => (
                  <button
                    className={`h-5 w-5 rounded border-2 transition ${coneColor === c.value ? "scale-110 border-primary" : "border-transparent"}`}
                    key={c.value}
                    onClick={() => setConeColor(c.value)}
                    style={{ backgroundColor: c.fill }}
                    title={c.label}
                    type="button"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Movements */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">Pfeil</span>
            {MOVE_TOOLS.map((t) => (
              <button
                className={`h-7 rounded-md border px-2 text-[10px] font-medium transition-colors ${
                  activeTool === t.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-secondary"
                }`}
                key={t.value}
                onClick={() => { setActiveTool(t.value); setArrowSource(null); }}
                style={{ color: activeTool === t.value ? undefined : t.color }}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Zones + Other */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">Zone</span>
            {toolBtn("zone", "Ziehen")}
            {ZONE_COLORS_LIST.map((c) => (
              <button
                className={`h-5 w-5 rounded border-2 transition ${zoneColor === c.value ? "scale-110 border-primary" : "border-transparent"}`}
                key={c.value}
                onClick={() => setZoneColor(c.value)}
                style={{ backgroundColor: c.fill }}
                title={c.label}
                type="button"
              />
            ))}
            {toolBtn("goal_big",  "Tor")}
            {toolBtn("goal_mini", "Minitor")}
          </div>

          {/* Select / Delete / Undo / Clear */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                activeTool === "select"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
              onClick={() => { setActiveTool("select"); setArrowSource(null); }}
              title="Auswahl / Verschieben"
              type="button"
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
            {toolBtn("delete", <Trash2 className="h-3.5 w-3.5" />, true)}
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background hover:bg-secondary disabled:opacity-40"
              disabled={history.length === 0}
              onClick={undo}
              title="Rückgängig"
              type="button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              className="ml-auto h-7 rounded-md border border-border bg-background px-2 text-[10px] hover:bg-secondary"
              onClick={clearAll}
              type="button"
            >
              Alles löschen
            </button>
          </div>
        </div>

        {/* Arrow hint */}
        {isArrowTool && (
          <p className="text-center text-xs text-muted-foreground">
            {arrowSource
              ? `Klicke Ziel für ${activeTool} (von ${arrowSource.label})`
              : "Klicke einen Spieler als Startpunkt"}
          </p>
        )}

        {/* SVG Field */}
        <div
          className="overflow-hidden rounded-xl border border-border"
          style={{ cursor: dragging ? "grabbing" : activeTool === "zone" ? "crosshair" : "default" }}
        >
          <svg
            className="w-full select-none touch-none"
            onClick={handleSvgClick}
            onMouseLeave={() => setMousePos(null)}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            ref={svgRef}
            style={{ background: "#1a2e1a" }}
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {movements.map((mov, i) => arrowMarker(`arr-${i}`, MOVEMENT_COLORS[mov.type] ?? "#6b7280"))}
              {arrowSource ? arrowMarker("arr-preview", "#94a3b8") : null}
            </defs>

            <FieldMarkings fieldType={field} />

            {/* Zones */}
            {zones.map((z, i) => {
              const c = ZONE_COLORS[z.color] ?? ZONE_COLORS.blue;
              return (
                <rect key={i}
                  className="cursor-pointer"
                  fill={c.fill} stroke={c.stroke} strokeDasharray="2,1.5" strokeWidth={0.5}
                  height={(z.h / 100) * FIELD.h} width={(z.w / 100) * FIELD.w}
                  x={lx(z.x)} y={ly(z.y)}
                  onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") { pushHistory(); setZones((prev) => prev.filter((_, idx) => idx !== i)); } }}
                />
              );
            })}

            {/* Zone draft */}
            {draftRect ? (
              <rect
                fill={ZONE_COLORS[zoneColor].fill}
                height={draftRect.h} width={draftRect.w}
                pointerEvents="none"
                stroke={ZONE_COLORS[zoneColor].stroke} strokeDasharray="2,1.5" strokeWidth={0.5}
                x={draftRect.x} y={draftRect.y}
              />
            ) : null}

            {/* Goals */}
            {goals.map((g, i) => {
              const cx = lx(g.x), cy = ly(g.y);
              const hw = (g.width / 100) * FIELD.w * 0.5;
              const depth = g.type === "big_goal" ? 2.5 : 1.5;
              const atTop = g.y <= 5;
              return (
                <rect key={i}
                  className="cursor-pointer"
                  fill="#374151" stroke="#9ca3af" strokeWidth={0.4}
                  height={depth} width={hw * 2}
                  x={cx - hw} y={atTop ? cy - depth : cy}
                  onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") { pushHistory(); setGoals((prev) => prev.filter((_, idx) => idx !== i)); } }}
                />
              );
            })}

            {/* Cones */}
            {cones.map((c) => {
              const cx = lx(c.x), cy = ly(c.y);
              const r = 2.2;
              const fill   = CONE_FILL[c.color ?? "orange"]   ?? CONE_FILL.orange;
              const stroke = CONE_STROKE[c.color ?? "orange"] ?? CONE_STROKE.orange;
              const isNew  = poppedId === c.id;
              const handlePointerDown = (e: React.PointerEvent) => {
                if (activeTool !== "select") return;
                e.stopPropagation();
                pushHistory();
                setDragging({ type: "cone", id: c.id });
                svgRef.current?.setPointerCapture(e.pointerId);
              };
              const handleClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (activeTool === "delete") { pushHistory(); setCones((prev) => prev.filter((x) => x.id !== c.id)); }
              };
              return (
                <g key={c.id} className={isNew ? "animate-svg-pop" : undefined} style={{ cursor: activeTool === "select" ? "grab" : "pointer" }}>
                  {/* invisible hit area */}
                  <circle cx={cx} cy={cy} r={6} fill="transparent" pointerEvents="all"
                    onClick={handleClick} onPointerDown={handlePointerDown} />
                  <polygon
                    points={`${cx},${cy - r * 1.1} ${cx - r},${cy + r * 0.7} ${cx + r},${cy + r * 0.7}`}
                    fill={fill} stroke={stroke} strokeWidth={0.3} pointerEvents="none"
                  />
                </g>
              );
            })}

            {/* Mannequins */}
            {mannequins.map((m) => {
              const cx = lx(m.x), cy = ly(m.y);
              return (
                <g key={m.id}
                  className={poppedId === m.id ? "animate-svg-pop" : undefined}
                  style={{ cursor: activeTool === "select" ? "grab" : "pointer" }}
                  onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") { pushHistory(); setMannequins((prev) => prev.filter((x) => x.id !== m.id)); } }}
                  onPointerDown={(e) => {
                    if (activeTool !== "select") return;
                    e.stopPropagation();
                    pushHistory();
                    setDragging({ type: "mannequin", id: m.id });
                    svgRef.current?.setPointerCapture(e.pointerId);
                  }}
                >
                  {/* invisible hit area */}
                  <rect x={cx - 5} y={cy - 7} width={10} height={12} fill="transparent" pointerEvents="all" />
                  <circle cx={cx} cy={cy - 3.2} r={1.4} fill="#94a3b8" stroke="#64748b" strokeWidth={0.3} pointerEvents="none" />
                  <rect x={cx - 1.1} y={cy - 1.8} width={2.2} height={3.5} rx={0.3} fill="#94a3b8" stroke="#64748b" strokeWidth={0.3} pointerEvents="none" />
                  <line x1={cx - 2.8} y1={cy - 0.8} x2={cx + 2.8} y2={cy - 0.8} stroke="#64748b" strokeWidth={0.5} pointerEvents="none" />
                </g>
              );
            })}

            {/* Movements */}
            {movements.map((mov, i) => {
              const p = players.find((pl) => pl.id === mov.from);
              if (!p) return null;
              const x1 = lx(p.x), y1 = ly(p.y), x2 = lx(mov.to_x), y2 = ly(mov.to_y);
              const color = MOVEMENT_COLORS[mov.type] ?? "#6b7280";
              const isDashed = mov.type === "run" || mov.type === "dribble";
              return (
                <line key={i}
                  className="cursor-pointer"
                  markerEnd={`url(#arr-${i})`}
                  stroke={color} strokeDasharray={isDashed ? "2.5,1.5" : undefined}
                  strokeWidth={mov.type === "shot" ? 1.5 : 1}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") { pushHistory(); setMovements((prev) => prev.filter((_, idx) => idx !== i)); } }}
                />
              );
            })}

            {/* Balls */}
            {balls.map((b) => {
              const cx = lx(b.x), cy = ly(b.y);
              const r = 2.2;
              return (
                <g key={b.id}
                  className={poppedId === b.id ? "animate-svg-pop" : undefined}
                  style={{ cursor: activeTool === "select" ? "grab" : "pointer" }}
                  onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") { pushHistory(); setBalls((prev) => prev.filter((x) => x.id !== b.id)); } }}
                  onPointerDown={(e) => {
                    if (activeTool !== "select") return;
                    e.stopPropagation();
                    pushHistory();
                    setDragging({ type: "ball", id: b.id });
                    svgRef.current?.setPointerCapture(e.pointerId);
                  }}
                >
                  {/* invisible hit area */}
                  <circle cx={cx} cy={cy} r={6} fill="transparent" pointerEvents="all" />
                  <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#374151" strokeWidth={0.4} pointerEvents="none" />
                  <line x1={cx - r * 0.7} y1={cy} x2={cx + r * 0.7} y2={cy} stroke="#374151" strokeWidth={0.2} pointerEvents="none" />
                  <line x1={cx} y1={cy - r * 0.7} x2={cx} y2={cy + r * 0.7} stroke="#374151" strokeWidth={0.2} pointerEvents="none" />
                </g>
              );
            })}

            {/* Preview arrow */}
            {arrowSource && mousePos ? (
              <line
                markerEnd="url(#arr-preview)"
                pointerEvents="none"
                stroke="#94a3b8" strokeDasharray="2,2" strokeWidth={0.8}
                x1={lx(arrowSource.x)} y1={ly(arrowSource.y)}
                x2={lx(mousePos.dx)}  y2={ly(mousePos.dy)}
              />
            ) : null}

            {/* Players */}
            {players.map((p) => {
              const cx = lx(p.x), cy = ly(p.y);
              const c = TEAM_COLORS[p.team] ?? TEAM_COLORS.A;
              const isSource = arrowSource?.id === p.id;
              return (
                <g key={p.id} className={poppedId === p.id ? "animate-svg-pop" : undefined} style={{ cursor: dragging?.id === p.id ? "grabbing" : activeTool === "select" ? "grab" : "pointer" }}>
                  {/* invisible hit area */}
                  <circle cx={cx} cy={cy} r={6} fill="transparent" pointerEvents="all"
                    onClick={(e) => handlePlayerClick(e, p)}
                    onPointerDown={(e) => handlePlayerPointerDown(e, p)}
                  />
                  <circle
                    cx={cx} cy={cy} r={3.5}
                    fill={c.fill} stroke={isSource ? "#fff" : c.stroke}
                    strokeWidth={isSource ? 1.2 : 0.7}
                    pointerEvents="none"
                  />
                  <text fill={c.text} fontSize="2.8" fontWeight="700" pointerEvents="none" textAnchor="middle" x={cx} y={cy + 1.1}>
                    {p.label.length > 4 ? p.label.slice(0, 4) : p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {players.length} Spieler · {movements.length} Pfeile · {zones.length} Zonen · {cones.length} Hütchen · {mannequins.length} Dummies · {balls.length} Bälle
        </p>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Abbrechen</Button>
          <Button disabled={isSaving} onClick={save} type="button">
            {isSaving ? "Speichert..." : "Diagramm speichern"}
          </Button>
        </div>
      </div>
    </SideDrawer>
  );
}
