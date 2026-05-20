"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTacticBoard } from "@/app/actions";
import { useConfirm } from "@/components/confirm-dialog";
import { TacticBoardEditor } from "@/components/tactic-board-editor";
import { cn } from "@/lib/utils";

type TacticBoard = {
  id: string;
  title: string;
  description: string | null;
  elements: unknown;
  updated_at: string;
};

type Player = {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
};

const dateFormatter = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function TacticBoardAccordion({
  boards,
  players,
}: {
  boards: TacticBoard[];
  players: Player[];
}) {
  const confirm = useConfirm();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [visibleBoards, setVisibleBoards] = useState(boards);
  const [, startTransition] = useTransition();

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(board: TacticBoard) {
    if (deletingIds.has(board.id)) return;
    const confirmed = await confirm({
      title: "Board löschen?",
      description: `"${board.title}" wird unwiderruflich gelöscht.`,
      confirmLabel: "Löschen",
      cancelLabel: "Abbrechen",
      destructive: true,
    });
    if (!confirmed) return;

    setDeletingIds((prev) => new Set(prev).add(board.id));
    setVisibleBoards((prev) => prev.filter((b) => b.id !== board.id));

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", board.id);
        await deleteTacticBoard(formData);
        toast.success("Board gelöscht");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Löschen");
        setVisibleBoards((prev) => {
          if (prev.some((b) => b.id === board.id)) return prev;
          return [board, ...prev].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        });
      }
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(board.id); return next; });
    });
  }

  if (visibleBoards.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Noch keine Taktikboards. Erstelle dein erstes Board.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleBoards.map((board) => {
        const isOpen = openIds.has(board.id);
        const isDeleting = deletingIds.has(board.id);

        return (
          <article
            className={cn(
              "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft transition-opacity duration-200",
              isDeleting && "opacity-50"
            )}
            key={board.id}
          >
            {/* Header row — always visible */}
            <div className="flex items-stretch">
              <button
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-secondary/50"
                onClick={() => toggleOpen(board.id)}
                type="button"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  {isOpen ? (
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{board.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {board.description
                      ? `${board.description.slice(0, 60)}${board.description.length > 60 ? "…" : ""} · `
                      : ""}
                    {dateFormatter.format(new Date(board.updated_at))}
                  </span>
                </span>
              </button>

              {/* Print button — always visible */}
              <button
                className="no-print flex items-center border-l border-border/60 px-3 text-muted-foreground transition hover:bg-secondary/50"
                onClick={() => window.print()}
                title="Board drucken"
                type="button"
              >
                <Printer className="h-4 w-4" />
              </button>

              {/* Delete button — always visible */}
              <button
                className="no-print flex items-center border-l border-border/60 px-3 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                disabled={isDeleting}
                onClick={() => handleDelete(board)}
                title="Board löschen"
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Collapsible editor */}
            <div
              className={cn(
                "grid transition-all duration-300 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-border p-4">
                  <TacticBoardEditor board={board} players={players} />
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
