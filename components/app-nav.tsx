"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  isActiveHref,
  isClusterActive,
  navClusters,
  type NavCluster
} from "@/components/nav-config";
import { cn } from "@/lib/utils";

const HOVER_CLOSE_DELAY_MS = 140;

export function AppNav() {
  const pathname = usePathname();
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openClusterId) return;
    const onClick = (event: MouseEvent) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(event.target as Node)) {
        setOpenClusterId(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenClusterId(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openClusterId]);

  useEffect(() => {
    setOpenClusterId(null);
  }, [pathname]);

  return (
    <nav
      aria-label="Hauptnavigation"
      className="relative flex items-center gap-1 rounded-full bg-white/8 p-1 ring-1 ring-white/10 backdrop-blur"
      ref={navRef}
    >
      {navClusters.map((cluster) => {
        const Icon = cluster.icon;
        const isActive = isClusterActive(pathname, cluster);

        if (cluster.href) {
          return (
            <Link
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium tracking-tight text-slate-300 transition-colors duration-200 ease-spring hover:text-white",
                isActive &&
                  "bg-white text-slate-950 shadow-soft hover:text-slate-950"
              )}
              href={cluster.href}
              key={cluster.id}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {cluster.label}
            </Link>
          );
        }

        const isOpen = openClusterId === cluster.id;

        return (
          <ClusterButton
            cluster={cluster}
            isActive={isActive}
            isOpen={isOpen}
            key={cluster.id}
            onClose={() =>
              setOpenClusterId((current) =>
                current === cluster.id ? null : current
              )
            }
            onOpen={() => setOpenClusterId(cluster.id)}
            pathname={pathname}
          />
        );
      })}
    </nav>
  );
}

function ClusterButton({
  cluster,
  isActive,
  isOpen,
  onOpen,
  onClose,
  pathname
}: {
  cluster: NavCluster;
  isActive: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  pathname: string;
}) {
  const Icon = cluster.icon;
  const items = cluster.items ?? [];
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
      closeTimeoutRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      cancelClose();
    };
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        if (!isOpen) onOpen();
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium tracking-tight text-slate-300 transition-colors duration-200 ease-spring hover:text-white",
          isActive &&
            "bg-white text-slate-950 shadow-soft hover:text-slate-950"
        )}
        onClick={() => (isOpen ? onClose() : onOpen())}
        onFocus={cancelClose}
        type="button"
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
        {cluster.label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200 ease-out",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        aria-hidden={!isOpen}
        className={cn(
          "absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 pt-2 origin-top",
          "transition-[opacity,transform] duration-200 ease-out",
          "motion-reduce:transition-none",
          isOpen
            ? "pointer-events-auto opacity-100 scale-y-100 translate-y-0"
            : "pointer-events-none opacity-0 scale-y-90 -translate-y-1"
        )}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        role="menu"
      >
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card text-foreground shadow-elevated">
          <ul className="p-1.5">
            {items.map((item) => {
              const ItemIcon = item.icon;
              const itemActive = isActiveHref(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-150",
                      itemActive
                        ? "bg-secondary text-foreground"
                        : "text-foreground/90 hover:bg-secondary/70"
                    )}
                    href={item.href}
                    onClick={onClose}
                    role="menuitem"
                    tabIndex={isOpen ? 0 : -1}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        itemActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground/80"
                      )}
                    >
                      <ItemIcon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-medium leading-tight">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
