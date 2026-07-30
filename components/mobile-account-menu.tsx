"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  CreditCard,
  LifeBuoy,
  LogOut,
  Menu,
  Plus,
  UserRound,
  Users,
  X
} from "lucide-react";
import { signOut } from "@/app/actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import type { TeamOption } from "@/lib/auth";

interface MobileAccountMenuProps {
  activeTeamId?: string;
  activeTeamName?: string;
  teams: TeamOption[];
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "select:not([disabled])",
  "input:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export function MobileAccountMenu({
  activeTeamId,
  activeTeamName,
  teams
}: MobileAccountMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(focusableSelector)
        ?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const desktopMedia = window.matchMedia("(min-width: 768px)");
    const onDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    desktopMedia.addEventListener("change", onDesktopChange);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktopMedia.removeEventListener("change", onDesktopChange);
      triggerElement?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <Button
        aria-controls="mobile-account-menu"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={
          isOpen
            ? "Team- und Kontomenü schließen"
            : "Team- und Kontomenü öffnen"
        }
        className="h-11 w-11 shrink-0 text-white hover:bg-white/10 md:hidden"
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </Button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[60] md:hidden">
              <button
                aria-label="Team- und Kontomenü schließen"
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
                tabIndex={-1}
                type="button"
              />

              <section
                aria-labelledby="mobile-account-menu-title"
                aria-modal="true"
                className="fixed right-3 top-[calc(env(safe-area-inset-top)+4.75rem)] max-h-[calc(100dvh-env(safe-area-inset-top)-5.5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-slate-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white shadow-elevated"
                id="mobile-account-menu"
                ref={panelRef}
                role="dialog"
              >
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-300">
                    <Users aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400"
                      id="mobile-account-menu-title"
                    >
                      Team &amp; Konto
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold">
                      {activeTeamName ?? "Workspace wählen"}
                    </p>
                  </div>
                  <Button
                    aria-label="Team- und Kontomenü schließen"
                    className="ml-auto h-11 w-11 shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"
                    onClick={() => setIsOpen(false)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-slate-400">Workspace</p>
                  <WorkspaceSwitcher
                    activeTeamId={activeTeamId}
                    onSelectionChange={() => setIsOpen(false)}
                    teams={teams}
                    variant="menu"
                  />
                </div>

                <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  <Link
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    href="/workspaces"
                    onClick={() => setIsOpen(false)}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Workspaces verwalten
                  </Link>
                  <Link
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    href="/pricing"
                    onClick={() => setIsOpen(false)}
                  >
                    <CreditCard aria-hidden="true" className="h-4 w-4" />
                    Tarife &amp; Abonnement
                  </Link>
                  <Link
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    href="/account"
                    onClick={() => setIsOpen(false)}
                  >
                    <UserRound aria-hidden="true" className="h-4 w-4" />
                    Konto &amp; Sicherheit
                  </Link>
                  <Link
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                    href="/support"
                    onClick={() => setIsOpen(false)}
                  >
                    <LifeBuoy aria-hidden="true" className="h-4 w-4" />
                    Hilfe &amp; Support
                  </Link>

                  <div className="[&_button]:h-11 [&_button]:w-full [&_button]:justify-start [&_button]:px-3">
                    <LanguageSwitcher />
                  </div>

                  <form action={signOut}>
                    <Button
                      className="h-11 w-full justify-start rounded-xl px-3 text-slate-200 hover:bg-white/10 hover:text-white"
                      type="submit"
                      variant="ghost"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" />
                      Abmelden
                    </Button>
                  </form>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
