"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { createPresetTraining } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const presets = [
  {
    value: "pressing",
    label: "Pressing nach Ballverlust",
    description: "6 Phasen, hohe Intensität, Umschaltverhalten."
  },
  {
    value: "buildup",
    label: "Spielaufbau gegen Pressing",
    description: "6 Phasen, mittlere Intensität, Aufbau-Prinzipien."
  },
  {
    value: "finishing",
    label: "Abschluss unter Druck",
    description: "6 Phasen, mittlere Intensität, letzter Pass + Abschluss."
  }
];

export function TrainingPresetDrawer({ initialDate }: { initialDate: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(presets[0].value);

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
          <div className="space-y-2">
            <Label>Vorlage</Label>
            <div className="space-y-2">
              {presets.map((preset) => {
                const isActive = selected === preset.value;
                return (
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors duration-150 active:scale-[0.99] ${
                      isActive
                        ? "border-foreground bg-secondary/60"
                        : "border-border bg-card hover:border-foreground/30"
                    }`}
                    key={preset.value}
                  >
                    <input
                      checked={isActive}
                      className="sr-only"
                      name="preset"
                      onChange={(e) => setSelected(e.target.value)}
                      type="radio"
                      value={preset.value}
                    />
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        isActive
                          ? "border-foreground bg-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {isActive ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-background" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold tracking-tight">
                        {preset.label}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        {preset.description}
                      </span>
                    </span>
                  </label>
                );
              })}
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
