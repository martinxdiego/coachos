"use client";

export type DiagramPlayer = {
  id: string;
  team: "A" | "B" | "neutral";
  role: string;
  label: string;
  x: number;
  y: number;
};

export type DiagramMovement = {
  from: string;
  to_x: number;
  to_y: number;
  type: "run" | "pass" | "dribble" | "shot" | "cross";
  label?: string;
  sequence?: number;
};

export type DiagramZone = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: "red" | "orange" | "blue" | "green";
};

export type DiagramGoal = {
  type: "big_goal" | "mini_goal";
  label: string;
  x: number;
  y: number;
  width: number;
};

export type PhaseDiagram = {
  field: "half" | "full" | "third" | "box";
  players?: DiagramPlayer[];
  movements?: DiagramMovement[];
  zones?: DiagramZone[];
  goals?: DiagramGoal[];
};

// --- Koordinaten-Mapping -------------------------------------------------
// Das logische Koordinatensystem (0-100) wird auf den SVG-Viewport gemappt.
// Feldmarkierungen passen sich an den field-Typ an.

const VIEWBOX_W = 100;
const VIEWBOX_H = 130;

// Spielfeld-Bereich innerhalb des Viewbox (Ränder für Labels)
const FIELD = { x: 5, y: 5, w: 90, h: 120 };

function lx(x: number) {
  return FIELD.x + (x / 100) * FIELD.w;
}
function ly(y: number) {
  return FIELD.y + (y / 100) * FIELD.h;
}

// --- Farben ---------------------------------------------------------------

const TEAM_COLORS: Record<DiagramPlayer["team"], { fill: string; stroke: string; text: string }> = {
  A:       { fill: "#3b82f6", stroke: "#1d4ed8", text: "#fff" },
  B:       { fill: "#ef4444", stroke: "#b91c1c", text: "#fff" },
  neutral: { fill: "#f59e0b", stroke: "#b45309", text: "#fff" },
};

const ZONE_COLORS: Record<DiagramZone["color"], { fill: string; stroke: string }> = {
  red:    { fill: "rgba(239,68,68,0.15)",  stroke: "#ef4444" },
  orange: { fill: "rgba(249,115,22,0.15)", stroke: "#f97316" },
  blue:   { fill: "rgba(59,130,246,0.15)", stroke: "#3b82f6" },
  green:  { fill: "rgba(34,197,94,0.15)",  stroke: "#22c55e" },
};

const MOVEMENT_COLORS: Record<DiagramMovement["type"], string> = {
  run:     "#6b7280",
  pass:    "#3b82f6",
  dribble: "#f59e0b",
  shot:    "#ef4444",
  cross:   "#8b5cf6",
};

// --- Hilfsfunktionen SVG --------------------------------------------------

function arrowMarker(id: string, color: string) {
  return (
    <marker
      key={id}
      id={id}
      markerWidth="6"
      markerHeight="6"
      refX="5"
      refY="3"
      orient="auto"
    >
      <path d="M0,0 L0,6 L6,3 z" fill={color} />
    </marker>
  );
}

function buildMovementPath(
  mov: DiagramMovement,
  players: DiagramPlayer[]
): { x1: number; y1: number; x2: number; y2: number } | null {
  const p = players.find((pl) => pl.id === mov.from);
  if (!p) return null;
  return { x1: lx(p.x), y1: ly(p.y), x2: lx(mov.to_x), y2: ly(mov.to_y) };
}

// --- Feldmarkierungen -----------------------------------------------------

function FieldMarkings({ fieldType }: { fieldType: PhaseDiagram["field"] }) {
  const fx = FIELD.x;
  const fy = FIELD.y;
  const fw = FIELD.w;
  const fh = FIELD.h;

  const grassLight = "#4ade80";
  const grassDark  = "#22c55e";
  const lineColor  = "rgba(255,255,255,0.85)";
  const lw         = 0.5;

  // Wechselnde Streifen
  const stripeCount = 8;
  const stripeH = fh / stripeCount;
  const stripes = Array.from({ length: stripeCount }, (_, i) => (
    <rect
      key={i}
      x={fx}
      y={fy + i * stripeH}
      width={fw}
      height={stripeH}
      fill={i % 2 === 0 ? grassLight : grassDark}
    />
  ));

  // Außenlinie
  const outline = (
    <rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke={lineColor} strokeWidth={lw} />
  );

  if (fieldType === "full") {
    const midY = fy + fh / 2;
    // Strafräume oben + unten (18m-Box ~ 40% Breite, 15% Höhe)
    const boxW = fw * 0.44;
    const boxH = fh * 0.13;
    const boxX = fx + (fw - boxW) / 2;
    // Torraum oben + unten (~20% Breite, ~5% Höhe)
    const goalAreaW = fw * 0.22;
    const goalAreaH = fh * 0.055;
    const goalAreaX = fx + (fw - goalAreaW) / 2;
    // Mittelkreis (r ~ 10% Höhe)
    const circleR = fh * 0.10;

    return (
      <g>
        {stripes}
        {outline}
        {/* Mittellinie */}
        <line x1={fx} y1={midY} x2={fx + fw} y2={midY} stroke={lineColor} strokeWidth={lw} />
        {/* Mittelkreis */}
        <circle cx={fx + fw / 2} cy={midY} r={circleR} fill="none" stroke={lineColor} strokeWidth={lw} />
        <circle cx={fx + fw / 2} cy={midY} r={0.8} fill={lineColor} />
        {/* Strafraum oben */}
        <rect x={boxX} y={fy} width={boxW} height={boxH} fill="none" stroke={lineColor} strokeWidth={lw} />
        <rect x={goalAreaX} y={fy} width={goalAreaW} height={goalAreaH} fill="none" stroke={lineColor} strokeWidth={lw} />
        {/* Strafraum unten */}
        <rect x={boxX} y={fy + fh - boxH} width={boxW} height={boxH} fill="none" stroke={lineColor} strokeWidth={lw} />
        <rect x={goalAreaX} y={fy + fh - goalAreaH} width={goalAreaW} height={goalAreaH} fill="none" stroke={lineColor} strokeWidth={lw} />
      </g>
    );
  }

  if (fieldType === "half") {
    const boxW = fw * 0.44;
    const boxH = fh * 0.22;
    const boxX = fx + (fw - boxW) / 2;
    const goalAreaW = fw * 0.22;
    const goalAreaH = fh * 0.09;
    const goalAreaX = fx + (fw - goalAreaW) / 2;
    const circleR = fh * 0.17;

    return (
      <g>
        {stripes}
        {outline}
        {/* Mittellinie unten */}
        <line x1={fx} y1={fy + fh} x2={fx + fw} y2={fy + fh} stroke={lineColor} strokeWidth={lw} />
        {/* Halbkreis Mittellinie */}
        <path
          d={`M ${fx} ${fy + fh} A ${circleR} ${circleR} 0 0 0 ${fx + fw} ${fy + fh}`}
          fill="none"
          stroke={lineColor}
          strokeWidth={lw}
        />
        {/* Strafraum oben */}
        <rect x={boxX} y={fy} width={boxW} height={boxH} fill="none" stroke={lineColor} strokeWidth={lw} />
        <rect x={goalAreaX} y={fy} width={goalAreaW} height={goalAreaH} fill="none" stroke={lineColor} strokeWidth={lw} />
      </g>
    );
  }

  if (fieldType === "third") {
    return (
      <g>
        {stripes}
        {outline}
      </g>
    );
  }

  // box
  const boxW = fw * 0.44;
  const boxH = fh * 0.55;
  const boxX = fx + (fw - boxW) / 2;
  const goalAreaW = fw * 0.22;
  const goalAreaH = fh * 0.22;
  const goalAreaX = fx + (fw - goalAreaW) / 2;
  return (
    <g>
      {stripes}
      {outline}
      <rect x={boxX} y={fy} width={boxW} height={boxH} fill="none" stroke={lineColor} strokeWidth={lw} />
      <rect x={goalAreaX} y={fy} width={goalAreaW} height={goalAreaH} fill="none" stroke={lineColor} strokeWidth={lw} />
    </g>
  );
}

// --- Tore -----------------------------------------------------------------

function Goals({ goals }: { goals: DiagramGoal[] }) {
  return (
    <>
      {goals.map((g, i) => {
        const cx = lx(g.x);
        const cy = ly(g.y);
        const halfW = (g.width / 100) * FIELD.w * 0.5;
        const depth = g.type === "big_goal" ? 2.5 : 1.5;
        const atTop = g.y <= 5;

        return (
          <g key={i}>
            {atTop ? (
              <rect
                x={cx - halfW}
                y={cy - depth}
                width={halfW * 2}
                height={depth}
                fill="#374151"
                stroke="#9ca3af"
                strokeWidth={0.4}
              />
            ) : (
              <rect
                x={cx - halfW}
                y={cy}
                width={halfW * 2}
                height={depth}
                fill="#374151"
                stroke="#9ca3af"
                strokeWidth={0.4}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

// --- Zonen ----------------------------------------------------------------

function Zones({ zones }: { zones: DiagramZone[] }) {
  return (
    <>
      {zones.map((z, i) => {
        const colors = ZONE_COLORS[z.color] ?? ZONE_COLORS.blue;
        return (
          <g key={i}>
            <rect
              x={lx(z.x)}
              y={ly(z.y)}
              width={(z.w / 100) * FIELD.w}
              height={(z.h / 100) * FIELD.h}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={0.5}
              strokeDasharray="2,1.5"
            />
            <text
              x={lx(z.x + z.w / 2)}
              y={ly(z.y) + 3.5}
              textAnchor="middle"
              fontSize="3"
              fill={colors.stroke}
              fontWeight="600"
            >
              {z.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

// --- Bewegungen -----------------------------------------------------------

function Movements({
  movements,
  players,
}: {
  movements: DiagramMovement[];
  players: DiagramPlayer[];
}) {
  const sorted = [...movements].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  return (
    <>
      {sorted.map((mov, i) => {
        const coords = buildMovementPath(mov, players);
        if (!coords) return null;
        const { x1, y1, x2, y2 } = coords;
        const color = MOVEMENT_COLORS[mov.type] ?? "#6b7280";
        const markerId = `arrow-${mov.type}-${i}`;

        const isDashed = mov.type === "run" || mov.type === "dribble";
        const strokeW = mov.type === "shot" ? 1.2 : 0.8;

        return (
          <g key={i}>
            <defs>{arrowMarker(markerId, color)}</defs>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={strokeW}
              strokeDasharray={isDashed ? "2.5,1.5" : undefined}
              markerEnd={`url(#${markerId})`}
            />
            {mov.label && (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 1.5}
                textAnchor="middle"
                fontSize="2.5"
                fill={color}
                fontWeight="500"
              >
                {mov.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// --- Spieler --------------------------------------------------------------

function Players({ players }: { players: DiagramPlayer[] }) {
  return (
    <>
      {players.map((p) => {
        const cx = lx(p.x);
        const cy = ly(p.y);
        const colors = TEAM_COLORS[p.team] ?? TEAM_COLORS.A;
        const r = 3.2;

        return (
          <g key={p.id}>
            <circle cx={cx} cy={cy} r={r} fill={colors.fill} stroke={colors.stroke} strokeWidth={0.6} />
            <text
              x={cx}
              y={cy + 1.1}
              textAnchor="middle"
              fontSize="2.8"
              fontWeight="700"
              fill={colors.text}
            >
              {p.label.length > 4 ? p.label.slice(0, 4) : p.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

// --- Legende --------------------------------------------------------------

function Legend() {
  const items = [
    { color: TEAM_COLORS.A.fill,       stroke: TEAM_COLORS.A.stroke,       label: "Team A" },
    { color: TEAM_COLORS.B.fill,       stroke: TEAM_COLORS.B.stroke,       label: "Team B" },
    { color: TEAM_COLORS.neutral.fill, stroke: TEAM_COLORS.neutral.stroke, label: "Neutral" },
  ];
  return (
    <g>
      {items.map((item, i) => (
        <g key={i} transform={`translate(${7 + i * 28}, ${VIEWBOX_H - 2})`}>
          <circle cx={0} cy={0} r={2} fill={item.color} stroke={item.stroke} strokeWidth={0.5} />
          <text x={3.5} y={0.8} fontSize="2.8" fill="#d1d5db">{item.label}</text>
        </g>
      ))}
    </g>
  );
}

// --- Haupt-Komponente -----------------------------------------------------

interface TrainingPhaseDiagramProps {
  diagram: unknown;
  className?: string;
}

export function TrainingPhaseDiagram({ diagram, className }: TrainingPhaseDiagramProps) {
  if (!diagram || typeof diagram !== "object") return null;

  const d = diagram as PhaseDiagram;
  const players  = d.players  ?? [];
  const movements = d.movements ?? [];
  const zones    = d.zones    ?? [];
  const goals    = d.goals    ?? [];

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full rounded-lg border border-white/10"
        style={{ background: "#1a2e1a" }}
      >
        <FieldMarkings fieldType={d.field ?? "half"} />
        <Zones zones={zones} />
        <Goals goals={goals} />
        <Movements movements={movements} players={players} />
        <Players players={players} />
        <Legend />
      </svg>
    </div>
  );
}
