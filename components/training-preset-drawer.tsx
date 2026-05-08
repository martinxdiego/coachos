"use client";

import { useMemo, useState } from "react";
import { Copy, Search } from "lucide-react";
import { createPresetTraining } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PresetTag = "Taktik" | "Technik" | "Fitness" | "Abschluss" | "U11" | "U13" | "U15" | "U19";

interface Preset {
  value: string;
  label: string;
  description: string;
  intensity: "Hoch" | "Mittel" | "Tief";
  tags: PresetTag[];
}

const presets: Preset[] = [
  {
    value: "pressing",
    label: "Pressing nach Ballverlust",
    description: "6 Phasen · Umschalten · Anlaufwinkel · Pressingfalle.",
    intensity: "Hoch",
    tags: ["Taktik", "Fitness", "U15", "U19"]
  },
  {
    value: "buildup",
    label: "Spielaufbau gegen Pressing",
    description: "6 Phasen · Dritter Mann · Aufbauprinzipien · Halbfeld.",
    intensity: "Mittel",
    tags: ["Taktik", "Technik", "U13", "U15", "U19"]
  },
  {
    value: "finishing",
    label: "Abschluss unter Druck",
    description: "6 Phasen · Letzter Pass · 4v4+TW · Druck-Challenge.",
    intensity: "Mittel",
    tags: ["Abschluss", "Technik", "U11", "U13", "U15"]
  }
];

const allTags: PresetTag[] = [
  "U11",
  "U13",
  "U15",
  "U19",
  "Taktik",
  "Technik",
  "Fitness",
  "Abschluss"
];

export function TrainingPresetDrawer({ initialDate }: { initialDate: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(presets[0].value);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<PresetTag | null>(null);

  const visiblePresets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return presets.filter((preset) => {
      if (activeTag && !preset.tags.includes(activeTag)) return false;
      if (!term) return true;
      return (
        preset.label.toLowerCase().includes(term) ||
        preset.description.toLowerCase().includes(term)
      );
    });
  }, [search, activeTag]);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        type="button"
        variant="outline"
      >
        <Copy aria-hidden="true" className="h-4 w-4" />
        Vorlage
      </Button>

      <SideDrawer
        description="Wähle eine Vorlage und passe Datum, Uhrzeit und Ort an. Phasen, Ziel und Coachingpunkte sind vorausgefüllt."
        eyebrow="Training"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Aus Vorlage erstellen"
      >
        <ToastForm
          action={createPresetTraining}
          className="space-y-5"
          onComplete={() => setIsOpen(false)}
          successMessage="Training aus Vorlage erstellt"
        >
          <div className="space-y-3">
            <Label>Vorlage</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Vorlagen suchen"
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Vorlagen suchen…"
                type="search"
                value={search}
              />
            </div>
            <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
              <button
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium tracking-tight transition active:scale-[0.97]",
                  activeTag === null
                    ? "border-transparent bg-slate-900 text-white"
                    : "border-border bg-card text-foreground hover:border-foreground/30"
                )}
                onClick={() => setActiveTag(null)}
                type="button"
              >
                Alle
              </button>
              {allTags.map((tag) => {
                const active = activeTag === tag;
                return (
                  <button
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] font-medium tracking-tight transition active:scale-[0.97]",
                      active
                        ? "border-transparent bg-emerald-600 text-white"
                        : "border-border bg-card text-foreground hover:border-foreground/30"
                    )}
                    key={tag}
                    onClick={() => setActiveTag(active ? null : tag)}
                    type="button"
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {visiblePresets.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
                  Keine Vorlage entspricht deiner Auswahl.
                </p>
              ) : (
                visiblePresets.map((preset) => {
                  const isActive = selected === preset.value;
                  return (
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors duration-150 active:scale-[0.99]",
                        isActive
                          ? "border-foreground bg-secondary/60"
                          : "border-border bg-card hover:border-foreground/30"
                      )}
                      key={preset.value}
                    >
                      <input
                        checked={isActive}
                        className="sr-only"
                        name="preset"
                        onChange={(event) => setSelected(event.target.value)}
                        type="radio"
                        value={preset.value}
                      />
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                          isActive
                            ? "border-foreground bg-foreground"
                            : "border-border bg-card"
                        )}
                      >
                        {isActive ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-background" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold tracking-tight">
                            {preset.label}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                              preset.intensity === "Hoch"
                                ? "bg-red-100 text-red-800"
                                : preset.intensity === "Mittel"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-emerald-100 text-emerald-900"
                            )}
                          >
                            {preset.intensity}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">
                          {preset.description}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          {preset.tags.map((tag) => (
                            <span
                              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium tracking-tight text-foreground/70"
                              key={tag}
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preset-date">Datum</Label>
              <Input
                defaultValue={initialDate}
                id="preset-date"
                name="date"
                required
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-time">Uhrzeit</Label>
              <Input id="preset-time" name="start_time" type="time" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preset-duration">Dauer (Minuten)</Label>
              <Input
                defaultValue="90"
                id="preset-duration"
                name="duration_minutes"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-location">Ort</Label>
              <Input id="preset-location" name="location" placeholder="Platz 2" />
            </div>
          </div>

          <Button className="w-full" type="submit">
            <Copy aria-hidden="true" className="h-4 w-4" />
            Vorlage erstellen
          </Button>
        </ToastForm>
      </SideDrawer>
    </>
  );
}
