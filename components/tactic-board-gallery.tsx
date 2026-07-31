"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, LayoutGrid, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTacticBoard } from "@/app/actions/tactics";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

type TacticBoard = {
  id: string;
  title: string;
  description: string | null;
  elements: unknown;
  updated_at: string;
};

type PreviewElement = {
  id: string;
  type: string;
  label?: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color?: string;
};

const dateFormatter = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function previewElements(value: unknown): PreviewElement[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const scenes = Array.isArray(record.scenes) ? record.scenes : [];
  const firstScene = scenes[0];
  const rawElements =
    firstScene && typeof firstScene === "object"
      ? (firstScene as Record<string, unknown>).elements
      : record.elements;

  if (!Array.isArray(rawElements)) return [];

  return rawElements
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item, index) => ({
      id: typeof item.id === "string" ? item.id : `preview-${index}`,
      type: typeof item.type === "string" ? item.type : "player",
      label: typeof item.label === "string" ? item.label : undefined,
      x: numberOr(item.x, 50),
      y: numberOr(item.y, 50),
      x2: typeof item.x2 === "number" ? item.x2 : undefined,
      y2: typeof item.y2 === "number" ? item.y2 : undefined,
      color: typeof item.color === "string" ? item.color : undefined
    }))
    .slice(0, 40);
}

function BoardPreview({ elements }: { elements: unknown }) {
  const items = previewElements(elements);
  const arrows = items.filter((item) => item.type === "arrow");
  const bodies = items.filter((item) => ["player", "opponent", "ball", "cone"].includes(item.type));

  return (
    <div className="relative aspect-[1.55] overflow-hidden bg-emerald-700 [print-color-adjust:exact]">
      <div className="absolute inset-3 rounded-lg border border-white/65" />
      <div className="absolute left-1/2 top-3 h-[calc(100%-1.5rem)] border-l border-white/55" />
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/55" />
      <div className="absolute left-3 top-1/2 h-20 w-14 -translate-y-1/2 border border-l-0 border-white/55" />
      <div className="absolute right-3 top-1/2 h-20 w-14 -translate-y-1/2 border border-r-0 border-white/55" />

      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <marker id="preview-arrow" markerHeight="5" markerWidth="7" orient="auto" refX="7" refY="2.5">
            <polygon fill="#f8fafc" points="0 0, 7 2.5, 0 5" />
          </marker>
        </defs>
        {arrows.map((item) => (
          <line
            key={item.id}
            markerEnd="url(#preview-arrow)"
            stroke={item.color ?? "#f8fafc"}
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeWidth="1.5"
            x1={`${item.x}%`}
            x2={`${item.x2 ?? item.x + 14}%`}
            y1={`${item.y}%`}
            y2={`${item.y2 ?? item.y - 12}%`}
          />
        ))}
      </svg>

      {bodies.map((item) => (
        <span
          className={cn(
            "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 text-[8px] font-bold shadow-sm",
            item.type === "player" && "h-5 w-5 bg-slate-950 text-white",
            item.type === "opponent" && "h-5 w-5 bg-rose-600 text-white",
            item.type === "ball" && "h-3 w-3 bg-white text-slate-950",
            item.type === "cone" && "h-3 w-3 rounded-sm bg-orange-500 text-transparent"
          )}
          key={item.id}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
        >
          {item.type === "ball" ? "•" : item.label?.slice(0, 2)}
        </span>
      ))}

      {items.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/70">
          Leeres Spielfeld
        </div>
      ) : null}
    </div>
  );
}

export function TacticBoardGallery({ boards }: { boards: TacticBoard[] }) {
  const confirm = useConfirm();
  const [visibleBoards, setVisibleBoards] = useState(boards);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleDelete(board: TacticBoard) {
    if (deletingId) return;
    const confirmed = await confirm({
      title: "Board löschen?",
      description: `„${board.title}“ wird unwiderruflich gelöscht.`,
      confirmLabel: "Löschen",
      cancelLabel: "Abbrechen",
      destructive: true
    });
    if (!confirmed) return;

    setDeletingId(board.id);
    setVisibleBoards((current) => current.filter((item) => item.id !== board.id));
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", board.id);
        await deleteTacticBoard(formData);
        toast.success("Board gelöscht");
      } catch (error) {
        setVisibleBoards((current) =>
          [...current, board].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )
        );
        toast.error(error instanceof Error ? error.message : "Board konnte nicht gelöscht werden");
      } finally {
        setDeletingId(null);
      }
    });
  }

  if (visibleBoards.length === 0) {
    return (
      <EmptyState
        body="Gib deinem ersten Board oben einen Namen. Dein aktueller Kader wird direkt als Startformation geladen."
        icon={LayoutGrid}
        title="Noch kein Taktikboard"
      />
    );
  }

  return (
    <section aria-label="Taktikboards" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visibleBoards.map((board) => (
        <article
          className={cn(
            "group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg",
            deletingId === board.id && "pointer-events-none opacity-50"
          )}
          key={board.id}
        >
          <Link aria-label={`${board.title} öffnen`} href={`/tactics/${board.id}`}>
            <BoardPreview elements={board.elements} />
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold tracking-tight">{board.title}</h2>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                    {board.description || "Ohne Beschreibung"}
                  </p>
                </div>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition group-hover:bg-emerald-100 group-hover:text-emerald-800">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Aktualisiert am {dateFormatter.format(new Date(board.updated_at))}
              </p>
            </div>
          </Link>
          <div className="flex justify-end border-t border-border/60 px-3 py-2">
            <Button
              aria-label={`${board.title} löschen`}
              disabled={deletingId === board.id}
              onClick={() => handleDelete(board)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
