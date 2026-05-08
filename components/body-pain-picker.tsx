"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { updatePlayer } from "@/app/actions";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PAIN_ZONE_PREFIX = "pain_zones:";

type View = "front" | "back";

interface BodyZone {
  id: string;
  label: string;
  view: View;
  cx: number;
  cy: number;
  rx?: number;
  ry?: number;
}

const zones: BodyZone[] = [
  { id: "head", label: "Kopf", view: "front", cx: 100, cy: 30, rx: 16, ry: 18 },
  { id: "neck", label: "Nacken", view: "front", cx: 100, cy: 56, rx: 10, ry: 6 },
  { id: "chest", label: "Brust", view: "front", cx: 100, cy: 86, rx: 32, ry: 18 },
  { id: "abdomen", label: "Bauch", view: "front", cx: 100, cy: 122, rx: 28, ry: 16 },
  { id: "shoulder_l", label: "Schulter links", view: "front", cx: 70, cy: 70, rx: 12, ry: 10 },
  { id: "shoulder_r", label: "Schulter rechts", view: "front", cx: 130, cy: 70, rx: 12, ry: 10 },
  { id: "biceps_l", label: "Bizeps links", view: "front", cx: 60, cy: 100, rx: 9, ry: 14 },
  { id: "biceps_r", label: "Bizeps rechts", view: "front", cx: 140, cy: 100, rx: 9, ry: 14 },
  { id: "forearm_l", label: "Unterarm links", view: "front", cx: 50, cy: 130, rx: 8, ry: 14 },
  { id: "forearm_r", label: "Unterarm rechts", view: "front", cx: 150, cy: 130, rx: 8, ry: 14 },
  { id: "hand_l", label: "Hand links", view: "front", cx: 44, cy: 158, rx: 7, ry: 9 },
  { id: "hand_r", label: "Hand rechts", view: "front", cx: 156, cy: 158, rx: 7, ry: 9 },
  { id: "groin", label: "Leiste", view: "front", cx: 100, cy: 158, rx: 14, ry: 10 },
  { id: "quad_l", label: "Oberschenkel links", view: "front", cx: 86, cy: 200, rx: 14, ry: 26 },
  { id: "quad_r", label: "Oberschenkel rechts", view: "front", cx: 114, cy: 200, rx: 14, ry: 26 },
  { id: "knee_l", label: "Knie links", view: "front", cx: 86, cy: 240, rx: 11, ry: 9 },
  { id: "knee_r", label: "Knie rechts", view: "front", cx: 114, cy: 240, rx: 11, ry: 9 },
  { id: "shin_l", label: "Schienbein links", view: "front", cx: 86, cy: 278, rx: 9, ry: 22 },
  { id: "shin_r", label: "Schienbein rechts", view: "front", cx: 114, cy: 278, rx: 9, ry: 22 },
  { id: "ankle_l", label: "Sprunggelenk links", view: "front", cx: 86, cy: 312, rx: 9, ry: 7 },
  { id: "ankle_r", label: "Sprunggelenk rechts", view: "front", cx: 114, cy: 312, rx: 9, ry: 7 },
  { id: "foot_l", label: "Fuss links", view: "front", cx: 84, cy: 332, rx: 12, ry: 8 },
  { id: "foot_r", label: "Fuss rechts", view: "front", cx: 116, cy: 332, rx: 12, ry: 8 },

  { id: "head_back", label: "Hinterkopf", view: "back", cx: 100, cy: 30, rx: 16, ry: 18 },
  { id: "upper_back", label: "Oberer Rücken", view: "back", cx: 100, cy: 86, rx: 30, ry: 18 },
  { id: "lower_back", label: "Unterer Rücken", view: "back", cx: 100, cy: 124, rx: 26, ry: 14 },
  { id: "triceps_l", label: "Trizeps links", view: "back", cx: 60, cy: 100, rx: 9, ry: 14 },
  { id: "triceps_r", label: "Trizeps rechts", view: "back", cx: 140, cy: 100, rx: 9, ry: 14 },
  { id: "glute_l", label: "Gesäss links", view: "back", cx: 86, cy: 160, rx: 14, ry: 12 },
  { id: "glute_r", label: "Gesäss rechts", view: "back", cx: 114, cy: 160, rx: 14, ry: 12 },
  { id: "hamstring_l", label: "Oberschenkel-Rückseite links", view: "back", cx: 86, cy: 200, rx: 14, ry: 26 },
  { id: "hamstring_r", label: "Oberschenkel-Rückseite rechts", view: "back", cx: 114, cy: 200, rx: 14, ry: 26 },
  { id: "calf_l", label: "Wade links", view: "back", cx: 86, cy: 270, rx: 11, ry: 22 },
  { id: "calf_r", label: "Wade rechts", view: "back", cx: 114, cy: 270, rx: 11, ry: 22 },
  { id: "achilles_l", label: "Achilles links", view: "back", cx: 86, cy: 308, rx: 7, ry: 8 },
  { id: "achilles_r", label: "Achilles rechts", view: "back", cx: 114, cy: 308, rx: 7, ry: 8 }
];

function parseZones(value: string | null | undefined): {
  zoneIds: string[];
  remainder: string;
} {
  if (!value) return { zoneIds: [], remainder: "" };
  const lines = value.split(/\r?\n/);
  let zoneIds: string[] = [];
  const rest: string[] = [];
  for (const line of lines) {
    if (line.startsWith(PAIN_ZONE_PREFIX)) {
      zoneIds = line
        .slice(PAIN_ZONE_PREFIX.length)
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    } else {
      rest.push(line);
    }
  }
  return { zoneIds, remainder: rest.join("\n").trim() };
}

function buildInjuriesText(zoneIds: string[], remainder: string) {
  const parts: string[] = [];
  if (zoneIds.length > 0) {
    parts.push(`${PAIN_ZONE_PREFIX}${zoneIds.join(",")}`);
  }
  if (remainder.trim().length > 0) {
    parts.push(remainder.trim());
  }
  return parts.join("\n");
}

function BodyOutline({ view }: { view: View }) {
  const common = "fill-slate-100 stroke-slate-300";
  if (view === "front") {
    return (
      <g aria-hidden="true" className={common} strokeWidth={1.2}>
        <ellipse cx={100} cy={30} rx={16} ry={18} />
        <rect x={94} y={46} width={12} height={14} rx={4} />
        <path d="M 60 70 Q 100 55 140 70 L 144 130 Q 130 142 130 154 L 130 168 L 70 168 L 70 154 Q 70 142 56 130 Z" />
        <ellipse cx={60} cy={100} rx={11} ry={18} />
        <ellipse cx={140} cy={100} rx={11} ry={18} />
        <ellipse cx={50} cy={132} rx={9} ry={18} />
        <ellipse cx={150} cy={132} rx={9} ry={18} />
        <ellipse cx={44} cy={158} rx={8} ry={10} />
        <ellipse cx={156} cy={158} rx={8} ry={10} />
        <path d="M 70 168 L 70 320 L 100 320 L 100 168 Z" />
        <path d="M 100 168 L 100 320 L 130 320 L 130 168 Z" />
        <ellipse cx={86} cy={332} rx={14} ry={10} />
        <ellipse cx={114} cy={332} rx={14} ry={10} />
      </g>
    );
  }
  return (
    <g aria-hidden="true" className={common} strokeWidth={1.2}>
      <ellipse cx={100} cy={30} rx={16} ry={18} />
      <rect x={94} y={46} width={12} height={14} rx={4} />
      <path d="M 60 70 Q 100 55 140 70 L 144 130 Q 130 142 130 154 L 130 175 L 70 175 L 70 154 Q 70 142 56 130 Z" />
      <ellipse cx={60} cy={100} rx={11} ry={18} />
      <ellipse cx={140} cy={100} rx={11} ry={18} />
      <ellipse cx={50} cy={132} rx={9} ry={18} />
      <ellipse cx={150} cy={132} rx={9} ry={18} />
      <path d="M 70 175 L 70 320 L 100 320 L 100 175 Z" />
      <path d="M 100 175 L 100 320 L 130 320 L 130 175 Z" />
      <ellipse cx={86} cy={332} rx={14} ry={10} />
      <ellipse cx={114} cy={332} rx={14} ry={10} />
    </g>
  );
}

interface BodyPainPickerProps {
  playerId: string;
  initialInjuries: string | null;
}

export function BodyPainPicker({ playerId, initialInjuries }: BodyPainPickerProps) {
  const initial = useMemo(() => parseZones(initialInjuries), [initialInjuries]);
  const [view, setView] = useState<View>("front");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initial.zoneIds)
  );
  const [remainder, setRemainder] = useState(initial.remainder);
  const remainderRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const parsed = parseZones(initialInjuries);
    setSelectedIds(new Set(parsed.zoneIds));
    setRemainder(parsed.remainder);
  }, [initialInjuries]);

  const visibleZones = zones.filter((zone) => zone.view === view);
  const selectedLabels = zones
    .filter((zone) => selectedIds.has(zone.id))
    .map((zone) => zone.label);

  function toggleZone(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const injuriesValue = buildInjuriesText(Array.from(selectedIds), remainder);

  return (
    <ToastForm
      action={updatePlayer}
      className="space-y-4"
      successMessage="Schmerzpunkte gespeichert"
    >
      <input name="id" type="hidden" value={playerId} />
      <input name="injuries" type="hidden" value={injuriesValue} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          aria-label="Ansicht wechseln"
          className="inline-flex rounded-full border border-border bg-secondary/50 p-0.5 text-[12px] font-medium"
          role="tablist"
        >
          {(["front", "back"] as const).map((option) => {
            const active = view === option;
            return (
              <button
                aria-selected={active}
                className={cn(
                  "rounded-full px-3 py-1 transition",
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-foreground/70 hover:text-foreground"
                )}
                key={option}
                onClick={() => setView(option)}
                role="tab"
                type="button"
              >
                {option === "front" ? "Vorderseite" : "Rückseite"}
              </button>
            );
          })}
        </div>
        <div className="text-[12px] text-muted-foreground">
          {selectedIds.size === 0
            ? "Tippe auf eine Region, um sie zu markieren."
            : `${selectedIds.size} Schmerz-Region${selectedIds.size === 1 ? "" : "en"} markiert`}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-white to-secondary/40 p-3">
          <svg
            aria-label={view === "front" ? "Körpergrafik Vorderseite" : "Körpergrafik Rückseite"}
            className="h-auto w-full"
            role="img"
            viewBox="0 0 200 360"
          >
            <BodyOutline view={view} />
            {visibleZones.map((zone) => {
              const active = selectedIds.has(zone.id);
              return (
                <ellipse
                  className={cn(
                    "cursor-pointer transition-all duration-150",
                    active
                      ? "fill-red-500/80 stroke-red-700"
                      : "fill-transparent stroke-transparent hover:fill-emerald-400/30"
                  )}
                  cx={zone.cx}
                  cy={zone.cy}
                  key={zone.id}
                  onClick={() => toggleZone(zone.id)}
                  rx={zone.rx ?? 12}
                  ry={zone.ry ?? 12}
                  strokeWidth={active ? 1.5 : 1}
                >
                  <title>{zone.label}</title>
                </ellipse>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Markierte Regionen
            </p>
            {selectedLabels.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Noch keine Schmerzpunkte markiert.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {selectedLabels.map((label) => (
                  <li
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-[12px] font-medium text-red-900 ring-1 ring-red-200"
                    key={label}
                  >
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-600" />
                    {label}
                  </li>
                ))}
              </ul>
            )}
            {selectedIds.size > 0 ? (
              <Button
                className="mt-3"
                onClick={() => setSelectedIds(new Set())}
                size="sm"
                type="button"
                variant="ghost"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Alle zurücksetzen
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium tracking-tight text-foreground" htmlFor="body-pain-notes">
              Zusatznotiz zu Verletzungen
            </label>
            <Textarea
              defaultValue={remainder}
              id="body-pain-notes"
              onChange={(event) => setRemainder(event.target.value)}
              placeholder="Z.B. Druckschmerz unter Belastung, seit Mittwoch."
              ref={remainderRef}
            />
          </div>

          <Button type="submit">
            <Save aria-hidden="true" className="h-4 w-4" />
            Schmerzpunkte speichern
          </Button>
        </div>
      </div>
    </ToastForm>
  );
}
