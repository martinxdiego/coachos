"use client";

import { useRef, useState } from "react";
import { MousePointer2, Trash2 } from "lucide-react";
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
  type PhaseDiagram,
} from "@/components/training-phase-diagram";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool =
  | "select"
  | "playerA"
  | "playerB"
  | "neutral"
  | "pass"
  | "run"
  | "shot"
  | "dribble"
  | "zone"
  | "goal_big"
  | "goal_mini"
  | "delete";

interface ZoneDraft {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
    <marker
      id={id}
      key={id}
      markerHeight="6"
      markerWidth="6"
      orient="auto"
      refX="5"
      refY="3"
    >
      <path d="M0,0 L0,6 L6,3 z" fill={color} />
    </marker>
  );
}

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

  const [field, setField] = useState<PhaseDiagram["field"]>(
    existingDiagram?.field ?? "half"
  );
  const [players, setPlayers] = useState<DiagramPlayer[]>(
    existingDiagram?.players ?? []
  );
  const [movements, setMovements] = useState<DiagramMovement[]>(
    existingDiagram?.movements ?? []
  );
  const [zones, setZones] = useState<DiagramZone[]>(
    existingDiagram?.zones ?? []
  );
  const [goals, setGoals] = useState<DiagramGoal[]>(
    existingDiagram?.goals ?? []
  );

  const [activeTool, setActiveTool] = useState<Tool>("playerA");
  const [zoneColor, setZoneColor] = useState<DiagramZone["color"]>("blue");
  const [arrowSource, setArrowSource] = useState<DiagramPlayer | null>(null);
  const [mousePos, setMousePos] = useState<{ dx: number; dy: number } | null>(
    null
  );
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Counters for auto-labelling ──────────────────────────────────────────

  function nextLabel(team: "A" | "B" | "neutral") {
    const prefix = team === "A" ? "A" : team === "B" ? "B" : "N";
    const existing = players.filter((p) => p.team === team).length;
    return `${prefix}${existing + 1}`;
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  function addPlayer(dx: number, dy: number, team: "A" | "B" | "neutral") {
    const id = `p-${Date.now()}`;
    setPlayers((prev) => [
      ...prev,
      { id, team, role: "", label: nextLabel(team), x: dx, y: dy },
    ]);
  }

  function addMovement(
    fromId: string,
    toX: number,
    toY: number,
    type: DiagramMovement["type"]
  ) {
    setMovements((prev) => [
      ...prev,
      { from: fromId, to_x: toX, to_y: toY, type, sequence: prev.length + 1 },
    ]);
  }

  function addGoal(dx: number, dy: number, type: DiagramGoal["type"]) {
    setGoals((prev) => [
      ...prev,
      { type, label: "", x: dx, y: dy, width: type === "big_goal" ? 14 : 7 },
    ]);
  }

  function addZone(x: number, y: number, w: number, h: number) {
    setZones((prev) => [
      ...prev,
      { label: "", x, y, w, h, color: zoneColor },
    ]);
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setMovements((prev) => prev.filter((m) => m.from !== id));
    if (arrowSource?.id === id) setArrowSource(null);
  }

  function removeMovement(idx: number) {
    setMovements((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeZone(idx: number) {
    setZones((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeGoal(idx: number) {
    setGoals((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearAll() {
    setPlayers([]);
    setMovements([]);
    setZones([]);
    setGoals([]);
    setArrowSource(null);
    setZoneDraft(null);
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

    if (draggingId) {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === draggingId ? { ...p, x: dx, y: dy } : p
        )
      );
      return;
    }

    if (activeTool === "zone" && zoneDraft) {
      setZoneDraft((prev) => (prev ? { ...prev, x2: dx, y2: dy } : null));
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
    setDraggingId(null);
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const { dx, dy } = coords(e);

    if (activeTool === "playerA") { addPlayer(dx, dy, "A"); return; }
    if (activeTool === "playerB") { addPlayer(dx, dy, "B"); return; }
    if (activeTool === "neutral") { addPlayer(dx, dy, "neutral"); return; }
    if (activeTool === "goal_big") { addGoal(dx, dy, "big_goal"); return; }
    if (activeTool === "goal_mini") { addGoal(dx, dy, "mini_goal"); return; }

    const isArrowTool =
      activeTool === "pass" ||
      activeTool === "run" ||
      activeTool === "shot" ||
      activeTool === "dribble";

    if (isArrowTool && arrowSource) {
      addMovement(arrowSource.id, dx, dy, activeTool as DiagramMovement["type"]);
      setArrowSource(null);
    }
  }

  function handlePlayerPointerDown(
    e: React.PointerEvent<SVGCircleElement>,
    player: DiagramPlayer
  ) {
    if (activeTool !== "select") return;
    e.stopPropagation();
    setDraggingId(player.id);
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePlayerClick(e: React.MouseEvent, player: DiagramPlayer) {
    e.stopPropagation();
    if (activeTool === "delete") { removePlayer(player.id); return; }

    const isArrowTool =
      activeTool === "pass" ||
      activeTool === "run" ||
      activeTool === "shot" ||
      activeTool === "dribble";

    if (isArrowTool) {
      setArrowSource((prev) => (prev?.id === player.id ? null : player));
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function save() {
    setIsSaving(true);
    try {
      const diagram: PhaseDiagram = { field, players, movements, zones, goals };
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

  // ── Render helpers ───────────────────────────────────────────────────────

  const FIELD_OPTIONS: { label: string; value: PhaseDiagram["field"] }[] = [
    { label: "Ganzes Feld", value: "full" },
    { label: "Halbes Feld", value: "half" },
    { label: "Sechzehner", value: "box" },
  ];

  const MOVE_TOOLS: { label: string; value: Tool; color: string }[] = [
    { label: "Pass", value: "pass", color: MOVEMENT_COLORS.pass },
    { label: "Lauf", value: "run", color: MOVEMENT_COLORS.run },
    { label: "Schuss", value: "shot", color: MOVEMENT_COLORS.shot },
    { label: "Dribbling", value: "dribble", color: MOVEMENT_COLORS.dribble },
  ];

  const ZONE_COLORS_LIST: { label: string; value: DiagramZone["color"]; fill: string }[] = [
    { label: "Blau", value: "blue", fill: "#3b82f6" },
    { label: "Rot", value: "red", fill: "#ef4444" },
    { label: "Orange", value: "orange", fill: "#f97316" },
    { label: "Grün", value: "green", fill: "#22c55e" },
  ];

  const isArrowTool =
    activeTool === "pass" ||
    activeTool === "run" ||
    activeTool === "shot" ||
    activeTool === "dribble";

  // Zone draft SVG rect
  const draftRect =
    zoneDraft
      ? {
          x: lx(Math.min(zoneDraft.x1, zoneDraft.x2)),
          y: ly(Math.min(zoneDraft.y1, zoneDraft.y2)),
          w: (Math.abs(zoneDraft.x2 - zoneDraft.x1) / 100) * FIELD.w,
          h: (Math.abs(zoneDraft.y2 - zoneDraft.y1) / 100) * FIELD.h,
        }
      : null;

  return (
    <SideDrawer
      eyebrow="Phase"
      isOpen={isOpen}
      onClose={onClose}
      title="Taktikboard"
    >
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
          <div className="flex items-center gap-1">
            <span className="w-14 text-[10px] uppercase tracking-wider text-muted-foreground">Spieler</span>
            {(["playerA", "playerB", "neutral"] as const).map((t) => {
              const team = t === "playerA" ? "A" : t === "playerB" ? "B" : "neutral";
              const c = TEAM_COLORS[team];
              return (
                <button
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white transition ${
                    activeTool === t ? "scale-110 border-primary shadow-md" : "border-transparent"
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

          {/* Movements */}
          <div className="flex items-center gap-1">
            <span className="w-14 text-[10px] uppercase tracking-wider text-muted-foreground">Pfeil</span>
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

          {/* Zone */}
          <div className="flex items-center gap-1">
            <span className="w-14 text-[10px] uppercase tracking-wider text-muted-foreground">Zone</span>
            <button
              className={`h-7 rounded-md border px-2 text-[10px] font-medium transition-colors ${
                activeTool === "zone"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
              onClick={() => { setActiveTool("zone"); setArrowSource(null); }}
              type="button"
            >
              Ziehen
            </button>
            {ZONE_COLORS_LIST.map((c) => (
              <button
                className={`h-5 w-5 rounded border-2 transition ${
                  zoneColor === c.value ? "border-primary scale-110" : "border-transparent"
                }`}
                key={c.value}
                onClick={() => setZoneColor(c.value)}
                style={{ backgroundColor: c.fill }}
                title={c.label}
                type="button"
              />
            ))}
          </div>

          {/* Other tools */}
          <div className="flex items-center gap-1">
            <span className="w-14 text-[10px] uppercase tracking-wider text-muted-foreground">Sonstige</span>
            <button
              className={`h-7 rounded-md border px-2 text-[10px] font-medium transition-colors ${
                activeTool === "goal_big"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
              onClick={() => { setActiveTool("goal_big"); setArrowSource(null); }}
              type="button"
            >
              Tor
            </button>
            <button
              className={`h-7 rounded-md border px-2 text-[10px] font-medium transition-colors ${
                activeTool === "goal_mini"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
              onClick={() => { setActiveTool("goal_mini"); setArrowSource(null); }}
              type="button"
            >
              Minitor
            </button>
            <button
              className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
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
            <button
              className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
                activeTool === "delete"
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-border bg-background hover:bg-secondary"
              }`}
              onClick={() => { setActiveTool("delete"); setArrowSource(null); }}
              title="Löschen"
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
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

        {/* Arrow source hint */}
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
          style={{ cursor: activeTool === "zone" ? "crosshair" : activeTool === "delete" ? "pointer" : "default" }}
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
              {movements.map((mov, i) =>
                arrowMarker(`arr-${i}`, MOVEMENT_COLORS[mov.type] ?? "#6b7280")
              )}
              {arrowSource ? arrowMarker("arr-preview", "#94a3b8") : null}
            </defs>

            {/* Field */}
            <FieldMarkings fieldType={field} />

            {/* Zones */}
            {zones.map((z, i) => {
              const c = ZONE_COLORS[z.color] ?? ZONE_COLORS.blue;
              return (
                <rect
                  className="cursor-pointer"
                  fill={c.fill}
                  height={(z.h / 100) * FIELD.h}
                  key={i}
                  onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") removeZone(i); }}
                  stroke={c.stroke}
                  strokeDasharray="2,1.5"
                  strokeWidth={0.5}
                  width={(z.w / 100) * FIELD.w}
                  x={lx(z.x)}
                  y={ly(z.y)}
                />
              );
            })}

            {/* Zone draft */}
            {draftRect ? (
              <rect
                fill={ZONE_COLORS[zoneColor].fill}
                height={draftRect.h}
                pointerEvents="none"
                stroke={ZONE_COLORS[zoneColor].stroke}
                strokeDasharray="2,1.5"
                strokeWidth={0.5}
                width={draftRect.w}
                x={draftRect.x}
                y={draftRect.y}
              />
            ) : null}

            {/* Goals */}
            {goals.map((g, i) => {
              const cx = lx(g.x);
              const cy = ly(g.y);
              const hw = (g.width / 100) * FIELD.w * 0.5;
              const depth = g.type === "big_goal" ? 2.5 : 1.5;
              const atTop = g.y <= 5;
              return (
                <g key={i}>
                  <rect
                    className="cursor-pointer"
                    fill="#374151"
                    height={depth}
                    onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") removeGoal(i); }}
                    stroke="#9ca3af"
                    strokeWidth={0.4}
                    width={hw * 2}
                    x={cx - hw}
                    y={atTop ? cy - depth : cy}
                  />
                </g>
              );
            })}

            {/* Movements */}
            {movements.map((mov, i) => {
              const p = players.find((pl) => pl.id === mov.from);
              if (!p) return null;
              const x1 = lx(p.x), y1 = ly(p.y);
              const x2 = lx(mov.to_x), y2 = ly(mov.to_y);
              const color = MOVEMENT_COLORS[mov.type] ?? "#6b7280";
              const isDashed = mov.type === "run" || mov.type === "dribble";
              return (
                <line
                  className="cursor-pointer"
                  key={i}
                  markerEnd={`url(#arr-${i})`}
                  onClick={(e) => { e.stopPropagation(); if (activeTool === "delete") removeMovement(i); }}
                  stroke={color}
                  strokeDasharray={isDashed ? "2.5,1.5" : undefined}
                  strokeWidth={mov.type === "shot" ? 1.5 : 1}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                />
              );
            })}

            {/* Preview arrow */}
            {arrowSource && mousePos ? (
              <line
                markerEnd="url(#arr-preview)"
                pointerEvents="none"
                stroke="#94a3b8"
                strokeDasharray="2,2"
                strokeWidth={0.8}
                x1={lx(arrowSource.x)}
                x2={lx(mousePos.dx)}
                y1={ly(arrowSource.y)}
                y2={ly(mousePos.dy)}
              />
            ) : null}

            {/* Players */}
            {players.map((p) => {
              const cx = lx(p.x), cy = ly(p.y);
              const c = TEAM_COLORS[p.team] ?? TEAM_COLORS.A;
              const isSource = arrowSource?.id === p.id;
              const r = 3.5;
              return (
                <g key={p.id} style={{ cursor: activeTool === "select" ? "grab" : "pointer" }}>
                  <circle
                    cx={cx}
                    cy={cy}
                    fill={c.fill}
                    onClick={(e) => handlePlayerClick(e, p)}
                    onPointerDown={(e) => handlePlayerPointerDown(e, p)}
                    r={r}
                    stroke={isSource ? "#fff" : c.stroke}
                    strokeWidth={isSource ? 1.2 : 0.7}
                  />
                  <text
                    fill={c.text}
                    fontSize="2.8"
                    fontWeight="700"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={cx}
                    y={cy + 1.1}
                  >
                    {p.label.length > 4 ? p.label.slice(0, 4) : p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Summary */}
        <p className="text-center text-xs text-muted-foreground">
          {players.length} Spieler · {movements.length} Bewegungen · {zones.length} Zonen · {goals.length} Tore
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Abbrechen
          </Button>
          <Button disabled={isSaving} onClick={save} type="button">
            {isSaving ? "Speichert..." : "Diagramm speichern"}
          </Button>
        </div>
      </div>
    </SideDrawer>
  );
}
