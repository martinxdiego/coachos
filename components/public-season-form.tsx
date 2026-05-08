"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { submitPublicSeasonForm } from "@/app/actions-public";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Player } from "@/lib/types";

interface PublicSeasonFormProps {
  accessToken: string;
  player: Player;
}

export function PublicSeasonForm({ accessToken, player }: PublicSeasonFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const filled = Boolean(player.season_form_completed_at);

  function handle(formData: FormData) {
    startTransition(async () => {
      try {
        await submitPublicSeasonForm(accessToken, formData);
        toast.success("Saisonblatt gespeichert");
        setOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Konnte nicht speichern.";
        toast.error(message);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <button
        className="flex w-full items-center justify-between gap-3 p-4"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground"
          >
            <UserRound className="h-5 w-5" />
          </span>
          <div className="text-left">
            <p className="text-[15px] font-semibold tracking-tight">
              Mein Saisonblatt
              {filled ? (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  ✓ Ausgefüllt
                </span>
              ) : null}
            </p>
            <p className="text-[12px] text-muted-foreground">
              Kontaktdaten, Lieblingsteam, Ziele, Medizinisches
            </p>
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-border p-4 sm:p-5">
          <form action={handle} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                defaultValue={player.contact ?? ""}
                name="contact"
                placeholder="Eigener Kontakt"
              />
              <Input
                defaultValue={player.parent_contact ?? ""}
                name="parent_contact"
                placeholder="Elternkontakt"
              />
              <Input
                defaultValue={player.emergency_contact ?? ""}
                name="emergency_contact"
                placeholder="Notfallkontakt"
              />
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={player.strong_foot ?? ""}
                name="strong_foot"
              >
                <option value="">Fuss offen</option>
                <option value="left">Links</option>
                <option value="right">Rechts</option>
                <option value="both">Beide</option>
              </select>
              <Input
                defaultValue={player.favorite_team ?? ""}
                name="favorite_team"
                placeholder="Lieblingsteam"
              />
              <Input
                defaultValue={player.favorite_player ?? ""}
                name="favorite_player"
                placeholder="Lieblingsspieler"
              />
            </div>
            <Textarea
              defaultValue={player.football_goals ?? ""}
              name="football_goals"
              placeholder="Meine Fussballziele"
            />
            <Textarea
              defaultValue={player.strengths ?? ""}
              name="strengths"
              placeholder="Meine Stärken"
            />
            <Textarea
              defaultValue={player.weaknesses ?? ""}
              name="weaknesses"
              placeholder="Woran ich arbeiten will"
            />
            <Textarea
              defaultValue={player.motivation ?? ""}
              name="motivation"
              placeholder="Was motiviert mich?"
            />
            <Textarea
              defaultValue={player.allergies ?? ""}
              name="allergies"
              placeholder="Allergien"
            />
            <Textarea
              defaultValue={player.injuries ?? ""}
              name="injuries"
              placeholder="Verletzungen"
            />
            <Textarea
              defaultValue={player.limitations ?? ""}
              name="limitations"
              placeholder="Einschränkungen"
            />
            <Textarea
              defaultValue={player.medications ?? ""}
              name="medications"
              placeholder="Medikamente"
            />
            <Button className="h-11 w-full" disabled={isPending} type="submit">
              {isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Speichere…
                </>
              ) : (
                "Saisonblatt speichern"
              )}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
