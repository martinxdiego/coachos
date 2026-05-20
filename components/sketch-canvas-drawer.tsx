"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Minus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadPhaseImage } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { Button } from "@/components/ui/button";

const COLORS = [
  { label: "Schwarz", value: "#1a1a1a" },
  { label: "Rot", value: "#ef4444" },
  { label: "Blau", value: "#3b82f6" },
];

const WIDTHS = [
  { label: "Dünn", value: 2 },
  { label: "Mittel", value: 5 },
  { label: "Dick", value: 10 },
];

const MAX_UNDO = 20;

interface SketchCanvasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  phaseId: string;
}

export function SketchCanvasDrawer({
  isOpen,
  onClose,
  phaseId,
}: SketchCanvasDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(WIDTHS[1].value);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setUndoStack([]);
  }, [isOpen]);

  function getCtx() {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext("2d") : null;
  }

  function pushUndo() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev.slice(-MAX_UNDO + 1), snapshot]);
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getCtx();
    if (!ctx) return;
    pushUndo();
    isDrawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const canvas = canvasRef.current!;
    const { x, y } = getPos(e);
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === "eraser" ? width * 4 : width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    // keep eraser transparent bg white when compositing
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "source-over";
    }
    void canvas;
  }

  function onPointerUp() {
    isDrawing.current = false;
    const ctx = getCtx();
    if (ctx) ctx.globalCompositeOperation = "source-over";
  }

  function undo() {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    ctx.putImageData(last, 0, 0);
    setUndoStack((prev) => prev.slice(0, -1));
  }

  function clear() {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    pushUndo();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas export fehlgeschlagen"));
        }, "image/png");
      });
      const file = new File([blob], `sketch-${Date.now()}.png`, {
        type: "image/png",
      });
      const formData = new FormData();
      formData.set("phase_id", phaseId);
      formData.set("image", file);
      await uploadPhaseImage(formData);
      toast.success("Skizze gespeichert");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SideDrawer
      eyebrow="Phase"
      isOpen={isOpen}
      onClose={onClose}
      title="Skizze zeichnen"
    >
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2">
          {/* Tool */}
          <div className="flex gap-1">
            <Button
              className="h-8 w-8 p-0"
              onClick={() => setTool("pen")}
              size="sm"
              type="button"
              variant={tool === "pen" ? "default" : "outline"}
              title="Stift"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              className="h-8 w-8 p-0"
              onClick={() => setTool("eraser")}
              size="sm"
              type="button"
              variant={tool === "eraser" ? "default" : "outline"}
              title="Radierer"
            >
              <Eraser className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="h-5 w-px bg-border" />

          {/* Width */}
          <div className="flex gap-1">
            {WIDTHS.map((w) => (
              <button
                className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                  width === w.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-secondary"
                }`}
                key={w.value}
                onClick={() => setWidth(w.value)}
                title={w.label}
                type="button"
              >
                <Minus
                  className="h-3.5 w-3.5 text-current"
                  strokeWidth={w.value > 5 ? 3 : w.value > 2 ? 2 : 1}
                />
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          {/* Colors */}
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                className={`h-8 w-8 rounded-md border-2 transition-all ${
                  color === c.value ? "border-primary scale-110" : "border-transparent"
                }`}
                key={c.value}
                onClick={() => setColor(c.value)}
                style={{ backgroundColor: c.value }}
                title={c.label}
                type="button"
              />
            ))}
          </div>

          <div className="ml-auto flex gap-1">
            <Button
              className="h-8 w-8 p-0"
              disabled={undoStack.length === 0}
              onClick={undo}
              size="sm"
              title="Rückgängig"
              type="button"
              variant="outline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              className="h-8 w-8 p-0"
              onClick={clear}
              size="sm"
              title="Löschen"
              type="button"
              variant="outline"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <canvas
            className="block w-full cursor-crosshair touch-none"
            height={600}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            ref={canvasRef}
            width={800}
          />
        </div>

        {/* Save */}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Abbrechen
          </Button>
          <Button disabled={isSaving} onClick={save} type="button">
            {isSaving ? "Speichert..." : "Skizze speichern"}
          </Button>
        </div>
      </div>
    </SideDrawer>
  );
}
