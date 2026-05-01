import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Crown,
  Dumbbell,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Link2,
  type LucideIcon,
  Medal,
  Settings,
  Shield,
  Star,
  Trophy,
  UserCircle2,
  UsersRound
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const primaryDesktopNav: NavItem[] = [
  { href: "/", label: "Heute", icon: LayoutDashboard },
  { href: "/players", label: "Spieler", icon: UsersRound },
  { href: "/trainings", label: "Training", icon: ClipboardList },
  { href: "/matches", label: "Spiele", icon: Trophy },
  { href: "/tactics", label: "Taktik", icon: Shield }
];

export const primaryMobileNav: NavItem[] = [
  { href: "/", label: "Heute", icon: LayoutDashboard },
  { href: "/players", label: "Kader", icon: UsersRound },
  { href: "/trainings", label: "Training", icon: ClipboardList },
  { href: "/matches", label: "Spiele", icon: Trophy }
];

export const moreSections: NavSection[] = [
  {
    title: "Spieltag",
    items: [
      {
        href: "/analysis",
        label: "Analyse",
        icon: BarChart3,
        description: "Spiel- und Trendauswertung"
      },
      {
        href: "/tactics",
        label: "Taktikboard",
        icon: Shield,
        description: "Aufstellung und Spielzüge"
      }
    ]
  },
  {
    title: "Entwicklung",
    items: [
      {
        href: "/evaluations",
        label: "Bewertungen",
        icon: Star,
        description: "Spielerbewertung pro Einheit"
      },
      {
        href: "/winnerpunkte",
        label: "Winnerpunkte",
        icon: Medal,
        description: "Punkte für Engagement vergeben"
      },
      {
        href: "/awards",
        label: "Hut-System",
        icon: Crown,
        description: "Auszeichnungen & Belohnungen"
      },
      {
        href: "/player-mode",
        label: "Spieler-Modus",
        icon: UserCircle2,
        description: "Sicht für Spieler & Eltern"
      }
    ]
  },
  {
    title: "Belastung & Plan",
    items: [
      {
        href: "/health",
        label: "Gesundheit",
        icon: HeartPulse,
        description: "Check-ins & Belastung"
      },
      {
        href: "/monday",
        label: "Montagstraining",
        icon: CalendarDays,
        description: "Wochenstart fix planen"
      },
      {
        href: "/calendar",
        label: "Kalender",
        icon: CalendarDays,
        description: "Alle Termine im Überblick"
      }
    ]
  },
  {
    title: "Material & Platz",
    items: [
      {
        href: "/materials",
        label: "Material",
        icon: FileText,
        description: "Druckvorlagen & Listen"
      },
      {
        href: "/pitch",
        label: "Platz",
        icon: Dumbbell,
        description: "Aufbauten und Stationen"
      }
    ]
  },
  {
    title: "Verwaltung",
    items: [
      {
        href: "/clubcorner",
        label: "Clubcorner / Quali",
        icon: Link2,
        description: "Vereinslinks und Qualifikation"
      },
      {
        href: "/workspaces",
        label: "Einstellungen",
        icon: Settings,
        description: "Workspace und Mitglieder"
      }
    ]
  }
];

export function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
