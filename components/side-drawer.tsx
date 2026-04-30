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
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-modal="true"
        className="absolute bottom-0 right-0 flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:bottom-4 md:right-4 md:w-[560px] md:rounded-2xl"
        role="dialog"
      >
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
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
              onClick={onClose}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}
