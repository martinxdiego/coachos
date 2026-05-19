import { Circle, G, Image, Line, Path, Polygon, Rect, Svg, Text, View } from "@react-pdf/renderer";
import { baseStyles, palette } from "./styles";
import type { PhaseDiagram } from "@/components/training-phase-diagram";

export function PdfHeader({
  eyebrow,
  title,
  meta
}: {
  eyebrow: string;
  title: string;
  meta?: string[];
}) {
  return (
    <View fixed style={baseStyles.header}>
      <View>
        <Text style={baseStyles.headerEyebrow}>{eyebrow}</Text>
        <Text style={baseStyles.headerTitle}>{title}</Text>
      </View>
      {meta && meta.length > 0 ? (
        <View>
          {meta.map((line, idx) => (
            <Text key={idx} style={baseStyles.headerMeta}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PdfFooter({ teamName }: { teamName: string }) {
  return (
    <View fixed style={baseStyles.footer}>
      <Text>{teamName} · CoachOS</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Seite ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function PdfSection({
  title,
  children
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={baseStyles.section}>
      {title ? (
        <>
          <Text style={baseStyles.sectionTitle}>{title}</Text>
          <View style={baseStyles.sectionDivider} />
        </>
      ) : null}
      {children}
    </View>
  );
}

export function PdfMetaGrid({
  items
}: {
  items: { label: string; value: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={baseStyles.metaGrid}>
      {items.map((item, idx) => (
        <View key={idx} style={baseStyles.metaTile}>
          <View style={baseStyles.metaTileInner}>
            <Text style={baseStyles.metaLabel}>{item.label}</Text>
            <Text style={baseStyles.metaValue}>{item.value || "—"}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function PdfCallout({
  label,
  text
}: {
  label: string;
  text: string;
}) {
  if (!text) return null;
  return (
    <View style={baseStyles.callout}>
      <Text style={baseStyles.calloutLabel}>{label}</Text>
      <Text style={baseStyles.calloutText}>{text}</Text>
    </View>
  );
}

export function PdfKeyValueBlock({
  label,
  text
}: {
  label: string;
  text: string | null | undefined;
}) {
  if (!text) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={baseStyles.phaseSubLabel}>{label}</Text>
      <Text style={baseStyles.phaseSubText}>{text}</Text>
    </View>
  );
}

export interface PdfPhaseImage {
  src: string;
  caption?: string;
}

export function PdfPhaseImages({ images }: { images: PdfPhaseImage[] }) {
  if (images.length === 0) return null;

  // 1 → full width, 2 → 50/50, 3+ → 1/3 each so a row of three fits cleanly.
  const widthPercent =
    images.length === 1 ? "100%" : images.length === 2 ? "50%" : "33.333%";

  return (
    <View style={baseStyles.phaseImagesWrap} wrap={false}>
      {images.map((image, idx) => (
        <View
          key={`${image.src}-${idx}`}
          style={[baseStyles.phaseImageTile, { width: widthPercent }]}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image, not <img>. */}
          <Image src={image.src} style={baseStyles.phaseImage} />
          {image.caption ? (
            <Text style={baseStyles.phaseImageCaption}>{image.caption}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function PdfChecklistRow({
  primary,
  secondary
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <View style={baseStyles.checkboxRow}>
      <View style={baseStyles.checkbox} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, color: palette.ink }}>{primary}</Text>
        {secondary ? (
          <Text style={{ fontSize: 8, color: palette.inkMuted, marginTop: 1 }}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── PDF Taktik-Diagramm ────────────────────────────────────────────────────
// Rendert das KI-generierte Diagramm-JSON als SVG direkt im PDF.
// @react-pdf/renderer unterstützt keine <marker>-Elemente, daher werden
// Pfeilspitzen manuell als Polygon berechnet.

const D_W = 240;   // SVG-Breite in pt
const D_H = 175;   // SVG-Höhe in pt
const FX = 4, FY = 4, FW = D_W - 8, FH = D_H - 14; // Feldbereich (Rand für Legende)

function dx(x: number) { return FX + (x / 100) * FW; }
function dy(y: number) { return FY + (y / 100) * FH; }

const TEAM_FILL:   Record<string, string> = { A: "#3b82f6", B: "#ef4444", neutral: "#f59e0b" };
const TEAM_STROKE: Record<string, string> = { A: "#1d4ed8", B: "#b91c1c", neutral: "#b45309" };
const MOVE_COLOR:  Record<string, string> = { run: "#6b7280", pass: "#3b82f6", dribble: "#f59e0b", shot: "#ef4444", cross: "#8b5cf6" };
const ZONE_FILL:   Record<string, string> = { red: "rgba(239,68,68,0.12)", orange: "rgba(249,115,22,0.12)", blue: "rgba(59,130,246,0.12)", green: "rgba(34,197,94,0.12)" };
const ZONE_STROKE: Record<string, string> = { red: "#ef4444", orange: "#f97316", blue: "#3b82f6", green: "#22c55e" };

function arrowhead(x1: number, y1: number, x2: number, y2: number, color: string) {
  const len = 4.5;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ax1 = x2 - len * Math.cos(angle - Math.PI / 6);
  const ay1 = y2 - len * Math.sin(angle - Math.PI / 6);
  const ax2 = x2 - len * Math.cos(angle + Math.PI / 6);
  const ay2 = y2 - len * Math.sin(angle + Math.PI / 6);
  return (
    <Polygon
      points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
      fill={color}
    />
  );
}

function PdfFieldMarkings({ fieldType }: { fieldType: string }) {
  const lc = "rgba(255,255,255,0.7)";
  const lw = 0.4;
  const stripeCount = 7;
  const stripes = Array.from({ length: stripeCount }, (_, i) => {
    const sh = FH / stripeCount;
    return (
      <Rect key={i} x={FX} y={FY + i * sh} width={FW} height={sh}
        fill={i % 2 === 0 ? "#3d7a3d" : "#2d6a2d"} />
    );
  });

  const boxW = FW * 0.44, boxH = FH * (fieldType === "full" ? 0.13 : 0.22);
  const boxX = FX + (FW - boxW) / 2;
  const goalAreaW = FW * 0.22, goalAreaH = FH * (fieldType === "full" ? 0.055 : 0.09);
  const goalAreaX = FX + (FW - goalAreaW) / 2;

  return (
    <G>
      {stripes}
      <Rect x={FX} y={FY} width={FW} height={FH} fill="none" stroke={lc} strokeWidth={lw} />
      {fieldType === "full" ? (
        <G>
          <Line x1={FX} y1={FY + FH / 2} x2={FX + FW} y2={FY + FH / 2} stroke={lc} strokeWidth={lw} />
          <Circle cx={FX + FW / 2} cy={FY + FH / 2} r={FH * 0.10} fill="none" stroke={lc} strokeWidth={lw} />
          <Rect x={boxX} y={FY} width={boxW} height={boxH} fill="none" stroke={lc} strokeWidth={lw} />
          <Rect x={goalAreaX} y={FY} width={goalAreaW} height={goalAreaH} fill="none" stroke={lc} strokeWidth={lw} />
          <Rect x={boxX} y={FY + FH - boxH} width={boxW} height={boxH} fill="none" stroke={lc} strokeWidth={lw} />
          <Rect x={goalAreaX} y={FY + FH - goalAreaH} width={goalAreaW} height={goalAreaH} fill="none" stroke={lc} strokeWidth={lw} />
        </G>
      ) : (
        <G>
          <Rect x={boxX} y={FY} width={boxW} height={boxH} fill="none" stroke={lc} strokeWidth={lw} />
          <Rect x={goalAreaX} y={FY} width={goalAreaW} height={goalAreaH} fill="none" stroke={lc} strokeWidth={lw} />
        </G>
      )}
    </G>
  );
}

export function PdfPhaseDiagram({ diagram }: { diagram: unknown }) {
  if (!diagram || typeof diagram !== "object") return null;
  const d = diagram as PhaseDiagram;
  const players   = d.players   ?? [];
  const movements = d.movements ?? [];
  const zones     = d.zones     ?? [];
  const goals     = d.goals     ?? [];

  return (
    <View style={{ marginTop: 6, marginBottom: 2 }}>
      <Text style={{ fontSize: 7, color: palette.inkMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.6 }}>
        Taktikskizze
      </Text>
      <Svg width={D_W} height={D_H}>
        {/* Spielfeld */}
        <PdfFieldMarkings fieldType={d.field ?? "half"} />

        {/* Zonen */}
        {zones.map((z, i) => (
          <G key={i}>
            <Rect
              x={dx(z.x)} y={dy(z.y)}
              width={(z.w / 100) * FW} height={(z.h / 100) * FH}
              fill={ZONE_FILL[z.color] ?? ZONE_FILL.blue}
              stroke={ZONE_STROKE[z.color] ?? ZONE_STROKE.blue}
              strokeWidth={0.5}
              strokeDasharray="3,2"
            />
          </G>
        ))}

        {/* Tore */}
        {goals.map((g, i) => {
          const cx = dx(g.x), cy = dy(g.y);
          const hw = ((g.width ?? 12) / 100) * FW * 0.5;
          const depth = g.type === "big_goal" ? 3 : 1.8;
          const atTop = g.y <= 5;
          return (
            <Rect key={i}
              x={cx - hw} y={atTop ? cy - depth : cy}
              width={hw * 2} height={depth}
              fill="#374151" stroke="#9ca3af" strokeWidth={0.4}
            />
          );
        })}

        {/* Bewegungen */}
        {[...movements]
          .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
          .map((mov, i) => {
            const p = players.find((pl) => pl.id === mov.from);
            if (!p) return null;
            const x1 = dx(p.x), y1 = dy(p.y);
            const x2 = dx(mov.to_x), y2 = dy(mov.to_y);
            const color = MOVE_COLOR[mov.type] ?? "#6b7280";
            const isDashed = mov.type === "run" || mov.type === "dribble";
            const sw = mov.type === "shot" ? 1.2 : 0.8;
            return (
              <G key={i}>
                <Line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={color} strokeWidth={sw}
                  strokeDasharray={isDashed ? "3,2" : undefined}
                />
                {arrowhead(x1, y1, x2, y2, color)}
              </G>
            );
          })}

        {/* Spieler */}
        {players.map((p) => {
          const cx = dx(p.x), cy = dy(p.y);
          const fill   = TEAM_FILL[p.team]   ?? TEAM_FILL.A;
          const stroke = TEAM_STROKE[p.team] ?? TEAM_STROKE.A;
          const label  = p.label.length > 4 ? p.label.slice(0, 4) : p.label;
          return (
            <G key={p.id}>
              <Circle cx={cx} cy={cy} r={4} fill={fill} stroke={stroke} strokeWidth={0.6} />
              <Text style={{ fontSize: 3.5, fill: "#fff", fontFamily: "Helvetica-Bold" }}
                x={cx} y={cy + 1.3} textAnchor="middle">
                {label}
              </Text>
            </G>
          );
        })}

        {/* Legende */}
        {[
          { label: "Team A", fill: TEAM_FILL.A,       stroke: TEAM_STROKE.A },
          { label: "Team B", fill: TEAM_FILL.B,       stroke: TEAM_STROKE.B },
          { label: "Neutral", fill: TEAM_FILL.neutral, stroke: TEAM_STROKE.neutral },
        ].map((item, i) => (
          <G key={i}>
            <Circle cx={FX + 3 + i * 38} cy={D_H - 5} r={2.5} fill={item.fill} stroke={item.stroke} strokeWidth={0.4} />
            <Text style={{ fontSize: 4, fill: "#aaa" }} x={FX + 8 + i * 38} y={D_H - 3.5}>{item.label}</Text>
          </G>
        ))}
      </Svg>
    </View>
  );
}
