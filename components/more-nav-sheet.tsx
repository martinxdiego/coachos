"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  isActiveHref,
  type NavCluster,
  getNavKey,
  getItemKey,
  getItemDescKey
} from "@/components/nav-config";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface MoreNavSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cluster: NavCluster | null;
}

export function MoreNavSheet({ isOpen, onClose, cluster }: MoreNavSheetProps) {
  const pathname = usePathname();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  if (!isOpen || !cluster) return null;

  const ClusterIcon = cluster.icon;
  const items = cluster.items ?? [];

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label={t("common.close", "Schließen")}
        className="absolute inset-0 bg-slate-950/45"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border/60 bg-card shadow-elevated animate-slide-up md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:w-[420px] md:rounded-3xl"
        role="dialog"
        style={{ willChange: "transform, opacity" }}
      >
        <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground">
              <ClusterIcon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                {t("nav.section", "Bereich")}
              </p>
              <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">
                {t(getNavKey(cluster.id), cluster.label)}
              </h2>
            </div>
          </div>
          <button
            aria-label={t("common.close", "Schließen")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform duration-150 ease-spring active:scale-95"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveHref(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 active:scale-[0.98]",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-foreground/90 hover:bg-secondary/70"
                    )}
                    href={item.href}
                    onClick={onClose}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground/80"
                      )}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium leading-tight">
                        {t(getItemKey(item.href), item.label)}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                          {t(getItemDescKey(item.href), item.description)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
