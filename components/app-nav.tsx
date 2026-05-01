"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  BarChart3,
  ClipboardList,
  Crown,
  Dumbbell,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Link2,
  Medal,
  Settings,
  Shield,
  Star,
  Trophy,
  UserCircle2,
  UsersRound
} from "lucide-react";
import { cn } from "@/lib/utils";

export const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Spieler", icon: UsersRound },
  { href: "/trainings", label: "Training", icon: ClipboardList },
  { href: "/matches", label: "Spiele", icon: Trophy },
  { href: "/analysis", label: "Analyse", icon: BarChart3 },
  { href: "/winnerpunkte", label: "Winnerpunkte", icon: Medal },
  { href: "/evaluations", label: "Bewertungen", icon: Star },
  { href: "/health", label: "Gesundheit", icon: HeartPulse },
  { href: "/monday", label: "Montagstraining", icon: CalendarDays },
  { href: "/clubcorner", label: "Clubcorner / Quali", icon: Link2 },
  { href: "/player-mode", label: "Spieler-Modus", icon: UserCircle2 },
  { href: "/awards", label: "Hut-System", icon: Crown },
  { href: "/tactics", label: "Taktikboard", icon: Shield },
  { href: "/materials", label: "Material", icon: FileText },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/pitch", label: "Platz", icon: Dumbbell },
  { href: "/workspaces", label: "Einstellungen", icon: Settings }
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-white/8 p-1 ring-1 ring-white/10">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-300 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/10 hover:text-white",
              isActive &&
                "bg-white text-slate-950 shadow-sm shadow-white/10 hover:bg-white hover:text-slate-950"
            )}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
