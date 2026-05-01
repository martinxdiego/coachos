"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Medal,
  Trophy,
  UsersRound
} from "lucide-react";
import { cn } from "@/lib/utils";

const mobileItems = [
  { href: "/", label: "Heute", icon: LayoutDashboard },
  { href: "/players", label: "Kader", icon: UsersRound },
  { href: "/trainings", label: "Training", icon: ClipboardList },
  { href: "/matches", label: "Spiele", icon: Trophy },
  { href: "/winnerpunkte", label: "Winner", icon: Medal }
];

export function MobileBottomNav({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  if (!enabled) {
    return null;
  }

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-slate-900/10 bg-white/92 p-1.5 shadow-[0_16px_50px_rgba(15,23,42,0.22)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              className={cn(
                "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-slate-500 transition-all",
                isActive && "bg-slate-950 text-white shadow-sm"
              )}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
