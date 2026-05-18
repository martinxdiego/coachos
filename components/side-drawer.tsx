"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SideDrawerProps {
  children: ReactNode;
  description?: string;
  eyebrow?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function SideDrawer({
  children,
  description,
  eyebrow,
  isOpen,
  onClose,
  title
}: SideDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Drawer schließen"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl transition-all duration-300 md:inset-x-auto md:bottom-4 md:right-4 md:top-[72px] md:max-h-[calc(100dvh-88px)] md:w-[min(92vw,640px)] md:rounded-2xl"
        role="dialog"
      >
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-xs uppercase tracking-[0.18em] text-primary">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-1 text-xl font-semibold">{title}</h2>
              {description ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="Schließen"
              className="shrink-0"
              onClick={onClose}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-5 md:pb-5">
          {children}
        </div>
      </aside>
    </div>
  );
}
