"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LayoutDashboard } from "lucide-react";

export function DashboardDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(window.matchMedia("(min-width: 1024px)").matches);
  }, []);

  return (
    <details
      className="group rounded-2xl border border-border/70 bg-secondary/25 p-3 shadow-soft sm:p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-2 text-left transition hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
          <LayoutDashboard className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Planung &amp; Teamdetails</span>
          <span className="block text-xs text-muted-foreground">Termine, Kaderstatus, Aufgaben und letzte Aktivitäten</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mt-5 space-y-8 border-t border-border/60 pt-5">{children}</div>
    </details>
  );
}
