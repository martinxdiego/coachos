"use client";

import { useEffect, useRef, useState } from "react";
import { BotMessageSquare, ChevronDown, ImagePlus, LayoutPanelLeft, Loader2, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadPhaseImage } from "@/app/actions";
import { PhaseImageUploader } from "@/components/phase-image-uploader";
import { SketchCanvasDrawer } from "@/components/sketch-canvas-drawer";
import { TacticBoardDrawer } from "@/components/tactic-board-drawer";
import { Button } from "@/components/ui/button";
import { prepareBrowserImageUpload } from "@/lib/browser-image-upload";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    e.target.value = "";
    if (!file) return;
    setMenuOpen(false);
    setUploadError(null);
    setIsProcessing(true);
    try {
      const preparedFile = await prepareBrowserImageUpload(file);
      const formData = new FormData();
      formData.set("phase_id", phaseId);
      formData.set("image", preparedFile);
      await uploadPhaseImage(formData);
      toast.success("Bild hochgeladen");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Hochladen fehlgeschlagen";
      setUploadError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
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
            aria-expanded={menuOpen}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-left text-[12px] text-muted-foreground transition hover:border-primary/40 hover:bg-secondary/50 hover:text-foreground"
            disabled={isProcessing}
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4 shrink-0" />
            )}
            <span>
              {isProcessing
                ? "Bild wird vorbereitet…"
                : "Bild, Skizze oder Taktik anhängen"}
            </span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-50" />
          </button>
        ) : (
          <Button
            aria-expanded={menuOpen}
            className="h-11 gap-1.5 text-xs sm:h-8"
            disabled={isProcessing}
            onClick={() => setMenuOpen((v) => !v)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {isProcessing ? "Wird vorbereitet…" : "Bild hinzufügen"}
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
                <span className="text-xs text-muted-foreground">
                  Bis 20 MB · wird mobil optimiert
                </span>
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

      {isProcessing ? (
        <p
          aria-live="polite"
          className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Bild wird optimiert und hochgeladen…
        </p>
      ) : null}

      {uploadError ? (
        <p
          className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {uploadError}
        </p>
      ) : null}

      {/* Hidden file input */}
      <input
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
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
