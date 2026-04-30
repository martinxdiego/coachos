"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { saveTacticBoard } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BoardElementType = "player" | "opponent" | "ball" | "cone" | "text" | "arrow";

interface BoardElement {
  id: string;
  type: BoardElementType;
  label: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color?: string;
}

interface TacticBoardEditorProps {
  board: {
    id: string;
    title: string;
    description: string | null;
    elements: unknown;
  };
}

function normalizeElements(value: unknown): BoardElement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is BoardElement => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Partial<BoardElement>;
    return Boolean(candidate.id && candidate.type);
  });
}

function elementClass(type: BoardElementType) {
  if (type === "player") {
    return "border-white bg-slate-950 text-white";
  }

  if (type === "opponent") {
    return "border-white bg-red-600 text-white";
  }

  if (type === "ball") {
    return "border-slate-950 bg-white text-slate-950";
  }

  if (type === "cone") {
    return "border-orange-200 bg-orange-500 text-white";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

export function TacticBoardEditor({ board }: TacticBoardEditorProps) {
  const initialElements = useMemo(
    () => normalizeElements(board.elements),
    [board.elements]
  );
  const [elements, setElements] = useState<BoardElement[]>(initialElements);
  const [dragId, setDragId] = useState<string | null>(null);

  function addElement(type: BoardElementType) {
    const label =
      type === "player"
        ? `${elements.filter((item) => item.type === "player").length + 1}`
        : type === "opponent"
          ? "G"
          : type === "ball"
            ? ""
            : type === "cone"
              ? ""
              : type === "arrow"
                ? "Laufweg"
                : "Notiz";

    setElements((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        label,
        x: 48,
        y: 50,
        x2: type === "arrow" ? 66 : undefined,
        y2: type === "arrow" ? 38 : undefined
      }
    ]);
  }

  function updatePosition(clientX: number, clientY: number) {
    if (!dragId) {
      return;
    }

    const field = document.getElementById(`field-${board.id}`);
    if (!field) {
      return;
    }

    const rect = field.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(96, Math.max(4, ((clientY - rect.top) / rect.height) * 100));

    setElements((current) =>
      current.map((item) => (item.id === dragId ? { ...item, x, y } : item))
    );
  }

  return (
    <div className="space-y-4">
      <form action={saveTacticBoard} className="space-y-4">
        <input name="id" type="hidden" value={board.id} />
        <input name="elements" type="hidden" value={JSON.stringify(elements)} />
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input defaultValue={board.title} name="title" required />
          <Textarea
            className="min-h-10"
            defaultValue={board.description ?? ""}
            name="description"
            placeholder="Beschreibung"
          />
          <Button type="submit">
            <Save aria-hidden="true" className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 no-print">
        <Button onClick={() => addElement("player")} size="sm" type="button">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Spieler
        </Button>
        <Button onClick={() => addElement("opponent")} size="sm" type="button" variant="secondary">
          Gegner
        </Button>
        <Button onClick={() => addElement("ball")} size="sm" type="button" variant="outline">
          Ball
        </Button>
        <Button onClick={() => addElement("cone")} size="sm" type="button" variant="outline">
          Hütchen
        </Button>
        <Button onClick={() => addElement("arrow")} size="sm" type="button" variant="outline">
          Pfeil
        </Button>
        <Button onClick={() => addElement("text")} size="sm" type="button" variant="outline">
          Notiz
        </Button>
        <Button
          onClick={() => setElements(initialElements)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Zurücksetzen
        </Button>
        <Button
          onClick={() => setElements([])}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Leeren
        </Button>
      </div>

      <div
        className="relative aspect-[1.55] min-h-[420px] overflow-hidden rounded-2xl border-4 border-emerald-950/10 bg-emerald-700 shadow-inner [print-color-adjust:exact]"
        id={`field-${board.id}`}
        onPointerMove={(event) => updatePosition(event.clientX, event.clientY)}
        onPointerUp={() => setDragId(null)}
      >
        <div className="absolute inset-4 rounded-2xl border-2 border-white/70" />
        <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] border-l-2 border-white/60" />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
        <div className="absolute left-4 top-1/2 h-36 w-24 -translate-y-1/2 border-2 border-l-0 border-white/60" />
        <div className="absolute right-4 top-1/2 h-36 w-24 -translate-y-1/2 border-2 border-r-0 border-white/60" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {elements
            .filter((item) => item.type === "arrow")
            .map((item) => (
              <line
                key={item.id}
                markerEnd="url(#arrowhead)"
                stroke="white"
                strokeDasharray="7 5"
                strokeWidth="3"
                x1={`${item.x}%`}
                x2={`${item.x2 ?? item.x + 14}%`}
                y1={`${item.y}%`}
                y2={`${item.y2 ?? item.y - 12}%`}
              />
            ))}
          <defs>
            <marker
              id="arrowhead"
              markerHeight="7"
              markerWidth="10"
              orient="auto"
              refX="10"
              refY="3.5"
            >
              <polygon fill="white" points="0 0, 10 3.5, 0 7" />
            </marker>
          </defs>
        </svg>

        {elements
          .filter((item) => item.type !== "arrow")
          .map((item) => (
            <button
              className={`absolute flex h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border px-2 text-xs font-semibold shadow-lg transition hover:scale-105 [print-color-adjust:exact] ${elementClass(item.type)}`}
              key={item.id}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragId(item.id);
              }}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              type="button"
            >
              {item.type === "ball" ? "●" : item.type === "cone" ? "▲" : item.label}
            </button>
          ))}
      </div>
    </div>
  );
}
