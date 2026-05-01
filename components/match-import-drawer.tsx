"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { importMatches } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MatchImportDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        type="button"
        variant="outline"
      >
        <Upload aria-hidden="true" className="h-4 w-4" />
        Importieren
      </Button>

      <SideDrawer
        description="CSV-Datei hochladen oder Liste einfügen. Trennzeichen werden automatisch erkannt."
        eyebrow="Matchday"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Spiele importieren"
      >
        <ToastForm
          action={importMatches}
          className="space-y-4"
          onComplete={() => setIsOpen(false)}
          successMessage="Spiele importiert"
        >
          <div className="space-y-2">
            <Label htmlFor="matches-file">CSV/TXT-Datei optional</Label>
            <Input
              accept=".csv,.txt"
              id="matches-file"
              name="matches_file"
              type="file"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="matches-csv">Oder Liste einfügen</Label>
            <Textarea
              className="min-h-44 font-mono text-[13px]"
              id="matches-csv"
              name="matches_csv"
              placeholder={
                "Datum;Gegner;Anspielzeit;Ort;home/away/neutral;Wettbewerb;Resultat;Kategorie\n2026-05-09;FC Beispiel;10:00;Gersag;home;Meisterschaft;;U16"
              }
            />
            <p className="text-[12px] leading-5 text-muted-foreground">
              Excel als CSV exportieren. PDF-Import kann später über einen
              spezialisierten Parser ergänzt werden.
            </p>
          </div>
          <Button className="w-full" type="submit">
            <Upload aria-hidden="true" className="h-4 w-4" />
            Spiele importieren
          </Button>
        </ToastForm>
      </SideDrawer>
    </>
  );
}
