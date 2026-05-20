"use client";

import { useEffect, useRef, useState } from "react";
import { BotMessageSquare, ChevronDown, ImagePlus, LayoutPanelLeft, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadPhaseImage } from "@/app/actions";
import { PhaseImageUploader } from "@/components/phase-image-uploader";
import { SketchCanvasDrawer } from "@/components/sketch-canvas-drawer";
import { TacticBoardDrawer } from "@/components/tactic-board-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhaseMediaMenuProps {
  images: string[];
  phaseId: string;
  phaseTitle: string;
}

export function PhaseMediaMenu({
  images,
  phaseId,
  phaseTitle,
}: PhaseMediaMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [tacticOpen, setTacticOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMenuOpen(false);
    const formData = new FormData();
    formData.set("phase_id", phaseId);
    formData.set("image", file);
    try {
      await uploadPhaseImage(formData);
      toast.success("Bild hochgeladen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hochladen fehlgeschlagen");
    }
    e.target.value = "";
  }

  function openTacticBoard() {
    setMenuOpen(false);
    setTacticOpen(true);
  }

  return (
    <>
      {images.length > 0 ? (
        <PhaseImageUploader
          hideControls={true}
          images={images}
          phaseId={phaseId}
          phaseTitle={phaseTitle}
        />
      ) : null}

      <div className={cn("relative mt-2", images.length === 0 ? "block" : "inline-block")} ref={menuRef}>
        {images.length === 0 ? (
          <button
            className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-left text-[12px] text-muted-foreground transition hover:border-primary/40 hover:bg-secondary/50 hover:text-foreground"
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            <ImagePlus className="h-4 w-4 shrink-0" />
            <span>Bild, Skizze oder Taktik anhängen</span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-50" />
          </button>
        ) : (
          <Button
            className="h-8 gap-1.5 text-xs"
            onClick={() => setMenuOpen((v) => !v)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="h-3.5 w-3.5" />
            Bild hinzufügen
          </Button>
        )}

        {menuOpen ? (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
            {/* File upload */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-secondary"
              onClick={() => {
                setMenuOpen(false);
                fileInputRef.current?.click();
              }}
              type="button"
            >
              <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-medium">Datei hochladen</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF</span>
              </span>
            </button>

            {/* Sketch */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-secondary"
              onClick={() => {
                setMenuOpen(false);
                setSketchOpen(true);
              }}
              type="button"
            >
              <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-medium">Skizze zeichnen</span>
                <span className="text-xs text-muted-foreground">Freihand auf Leinwand</span>
              </span>
            </button>

            {/* Tactics board */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-secondary"
              onClick={openTacticBoard}
              type="button"
            >
              <LayoutPanelLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-medium">Taktikboard</span>
                <span className="text-xs text-muted-foreground">Spieler, Pfeile, Zonen, Tore</span>
              </span>
            </button>

            {/* AI image – placeholder */}
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-secondary"
              disabled
              type="button"
            >
              <BotMessageSquare className="h-4 w-4 shrink-0" />
              <span>
                <span className="block font-medium">Mit KI erstellen</span>
                <span className="text-xs">Bald verfügbar</span>
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Hidden file input */}
      <input
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />

      {/* Sketch drawer */}
      <SketchCanvasDrawer
        isOpen={sketchOpen}
        onClose={() => setSketchOpen(false)}
        phaseId={phaseId}
      />

      {/* Tactic board drawer */}
      <TacticBoardDrawer
        isOpen={tacticOpen}
        onClose={() => setTacticOpen(false)}
        phaseId={phaseId}
      />
    </>
  );
}
