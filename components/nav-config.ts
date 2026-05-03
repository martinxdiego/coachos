import {
  BarChart3,
  Building2,
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

export interface NavCluster {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  items?: NavItem[];
}

export const navClusters: NavCluster[] = [
  {
    id: "today",
    label: "Heute",
    icon: LayoutDashboard,
    href: "/"
  },
  {
    id: "training",
    label: "Training",
    icon: ClipboardList,
    items: [
      {
        href: "/trainings",
        label: "Trainings",
        icon: ClipboardList,
        description: "Einheiten planen und durchführen"
      },
      {
        href: "/monday",
        label: "Montagstraining",
        icon: CalendarDays,
        description: "Wochenstart fix planen"
      },
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
      },
      {
        href: "/tactics",
        label: "Taktikboard",
        icon: Shield,
        description: "Spielzüge mit Animation"
      }
    ]
  },
  {
    id: "matches",
    label: "Spiele",
    icon: Trophy,
    items: [
      {
        href: "/matches",
        label: "Spiele",
        icon: Trophy,
        description: "Aufstellung, Formation, Ergebnis"
      },
      {
        href: "/analysis",
        label: "Analyse",
        icon: BarChart3,
        description: "Spiel- und Trendauswertung"
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
    id: "team",
    label: "Team",
    icon: UsersRound,
    items: [
      {
        href: "/players",
        label: "Spieler",
        icon: UsersRound,
        description: "Kader und Profile"
      },
      {
        href: "/evaluations",
        label: "Bewertungen",
        icon: Star,
        description: "Spielerbewertung pro Einheit"
      },
      {
        href: "/health",
        label: "Gesundheit",
        icon: HeartPulse,
        description: "Check-ins & Belastung"
      },
      {
        href: "/awards",
        label: "Hut-System",
        icon: Crown,
        description: "Auszeichnungen & Belohnungen"
      },
      {
        href: "/winnerpunkte",
        label: "Winnerpunkte",
        icon: Medal,
        description: "Punkte für Engagement"
      }
    ]
  },
  {
    id: "club",
    label: "Verein",
    icon: Building2,
    items: [
      {
        href: "/clubcorner",
        label: "Clubcorner / Quali",
        icon: Link2,
        description: "Vereinslinks und Qualifikation"
      },
      {
        href: "/player-mode",
        label: "Spieler-Modus",
        icon: UserCircle2,
        description: "Sicht für Spieler & Eltern"
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

export function isClusterActive(
  pathname: string,
  cluster: NavCluster
): boolean {
  if (cluster.href) {
    return isActiveHref(pathname, cluster.href);
  }
  return cluster.items?.some((item) => isActiveHref(pathname, item.href)) ?? false;
}
