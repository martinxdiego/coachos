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

type FieldTemplate = "blank" | "full" | "half" | "box";

const TEMPLATES: { label: string; value: FieldTemplate }[] = [
  { label: "Leer", value: "blank" },
  { label: "Ganzes Feld", value: "full" },
  { label: "Halbes Feld", value: "half" },
  { label: "Sechzehner", value: "box" },
];

// ─── Field drawing on HTML canvas ────────────────────────────────────────────

function drawFieldTemplate(
  ctx: CanvasRenderingContext2D,
  template: FieldTemplate
) {
  const { width: w, height: h } = ctx.canvas;

  if (template === "blank") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // Green striped background
  const stripeCount = 8;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#3d7a3d" : "#2d6a2d";
    ctx.fillRect(0, i * (h / stripeCount), w, h / stripeCount);
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1.5, w / 320);
  ctx.lineCap = "round";

  const pad = w * 0.05;
  const fw = w - pad * 2;
  const fh = h - pad * 2;
  const fx = pad;
  const fy = pad;

  if (template === "full") {
    // Outer border
    ctx.strokeRect(fx, fy, fw, fh);

    // Center line (vertical — landscape pitch, goals left/right)
    ctx.beginPath();
    ctx.moveTo(fx + fw / 2, fy);
    ctx.lineTo(fx + fw / 2, fy + fh);
    ctx.stroke();

    // Center circle
    const cr = fh * 0.2;
    ctx.beginPath();
    ctx.arc(fx + fw / 2, fy + fh / 2, cr, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(fx + fw / 2, fy + fh / 2, Math.max(2, w / 200), 0, Math.PI * 2);
    ctx.fill();

    // Penalty boxes (left and right)
    const boxH = fh * 0.46;
    const boxW = fw * 0.14;
    const boxY = fy + (fh - boxH) / 2;
    ctx.strokeRect(fx, boxY, boxW, boxH);
    ctx.strokeRect(fx + fw - boxW, boxY, boxW, boxH);

    // Goal areas
    const gaH = fh * 0.24;
    const gaW = fw * 0.055;
    const gaY = fy + (fh - gaH) / 2;
    ctx.strokeRect(fx, gaY, gaW, gaH);
    ctx.strokeRect(fx + fw - gaW, gaY, gaW, gaH);

    // Penalty arcs (outside boxes)
    const pArcR = fh * 0.14;
    ctx.beginPath();
    ctx.arc(fx + fw * 0.115, fy + fh / 2, pArcR, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fx + fw * 0.885, fy + fh / 2, pArcR, (Math.PI * 2) / 3, (Math.PI * 4) / 3);
    ctx.stroke();

    // Penalty spots
    const spotR = Math.max(3, w / 200);
    ctx.beginPath();
    ctx.arc(fx + fw * 0.115, fy + fh / 2, spotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + fw * 0.885, fy + fh / 2, spotR, 0, Math.PI * 2);
    ctx.fill();

    // Corner arcs
    const cr2 = Math.max(6, w / 80);
    [
      [fx, fy, 0, Math.PI / 2],
      [fx + fw, fy, Math.PI / 2, Math.PI],
      [fx + fw, fy + fh, Math.PI, (Math.PI * 3) / 2],
      [fx, fy + fh, (Math.PI * 3) / 2, Math.PI * 2],
    ].forEach(([cx, cy, s, e]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, cr2, s, e);
      ctx.stroke();
    });
  } else if (template === "half") {
    // Half field — left half, goal on left
    ctx.strokeRect(fx, fy, fw, fh);

    // Penalty box (expanded since only half shown)
    const boxH = fh * 0.46;
    const boxW = fw * 0.28;
    const boxY = fy + (fh - boxH) / 2;
    ctx.strokeRect(fx, boxY, boxW, boxH);

    // Goal area
    const gaH = fh * 0.24;
    const gaW = fw * 0.11;
    const gaY = fy + (fh - gaH) / 2;
    ctx.strokeRect(fx, gaY, gaW, gaH);

    // Penalty arc (outside box)
    const pArcR = fh * 0.14;
    ctx.beginPath();
    ctx.arc(fx + fw * 0.23, fy + fh / 2, pArcR, -Math.PI / 2.8, Math.PI / 2.8);
    ctx.stroke();

    // Penalty spot
    const spotR = Math.max(3, w / 200);
    ctx.beginPath();
    ctx.arc(fx + fw * 0.23, fy + fh / 2, spotR, 0, Math.PI * 2);
    ctx.fill();

    // Center arc on right edge
    ctx.beginPath();
    ctx.arc(fx + fw, fy + fh / 2, fh * 0.2, Math.PI * 0.58, Math.PI * 1.42);
    ctx.stroke();
  } else if (template === "box") {
    // Penalty box only — zoomed in, goal at top
    const goalH = h * 0.07;
    const goalW = fw * 0.22;
    const goalX = fx + (fw - goalW) / 2;

    // Goal (dark rect above field)
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(goalX, fy - goalH, goalW, goalH);
    ctx.strokeRect(goalX, fy - goalH, goalW, goalH);
    ctx.fillStyle = "rgba(255,255,255,0.9)";

    // Penalty box border
    ctx.strokeRect(fx, fy, fw, fh);

    // Goal area inside
    const gaW = fw * 0.5;
    const gaH = fh * 0.2;
    const gaX = fx + (fw - gaW) / 2;
    ctx.strokeRect(gaX, fy, gaW, gaH);

    // Penalty spot
    const spotR = Math.max(3, w / 200);
    const pspotX = fx + fw / 2;
    const pspotY = fy + fh * 0.42;
    ctx.beginPath();
    ctx.arc(pspotX, pspotY, spotR, 0, Math.PI * 2);
    ctx.fill();

    // Penalty arc (only part outside goal area, below it)
    const arcR = fh * 0.32;
    ctx.beginPath();
    ctx.arc(pspotX, pspotY, arcR, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [template, setTemplate] = useState<FieldTemplate>("blank");
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [width, setWidth] = useState(WIDTHS[1].value);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isDrawing = useRef(false);
  // Base snapshot after template is drawn (undo can't go past this)
  const baseSnapshot = useRef<ImageData | null>(null);

  function applyTemplate(t: FieldTemplate) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawFieldTemplate(ctx, t);
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    baseSnapshot.current = snap;
    setUndoStack([]);
  }

  // Apply template when drawer opens or template changes
  useEffect(() => {
    if (!isOpen) return;
    applyTemplate(template);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, template]);

  function getCtx() {
    return canvasRef.current?.getContext("2d") ?? null;
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
    const { x, y } = getPos(e);
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === "eraser" ? width * 4 : width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (tool === "eraser") ctx.globalCompositeOperation = "source-over";
  }

  function onPointerUp() {
    isDrawing.current = false;
    const ctx = getCtx();
    if (ctx) ctx.globalCompositeOperation = "source-over";
  }

  function undo() {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    if (undoStack.length === 0) {
      // Restore base template
      if (baseSnapshot.current) ctx.putImageData(baseSnapshot.current, 0, 0);
      return;
    }
    const last = undoStack[undoStack.length - 1];
    ctx.putImageData(last, 0, 0);
    setUndoStack((prev) => prev.slice(0, -1));
  }

  function clear() {
    pushUndo();
    applyTemplate(template);
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
      toast.error(
        err instanceof Error ? err.message : "Fehler beim Speichern"
      );
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
      <div className="flex flex-col gap-3">
        {/* Field template selector */}
        <div className="flex gap-1">
          {TEMPLATES.map((t) => (
            <button
              className={`flex-1 rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors ${
                template === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
              key={t.value}
              onClick={() => setTemplate(t.value)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Drawing toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2">
          {/* Tool */}
          <div className="flex gap-1">
            <Button
              className="h-8 w-8 p-0"
              onClick={() => setTool("pen")}
              size="sm"
              title="Stift"
              type="button"
              variant={tool === "pen" ? "default" : "outline"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              className="h-8 w-8 p-0"
              onClick={() => setTool("eraser")}
              size="sm"
              title="Radierer"
              type="button"
              variant={tool === "eraser" ? "default" : "outline"}
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
                  color === c.value ? "scale-110 border-primary" : "border-transparent"
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
              title="Löschen (Vorlage bleibt)"
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
            onPointerLeave={onPointerUp}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
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
