import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CalendarPlus,
  Shield,
  Trophy,
  UserPlus,
  type LucideIcon
} from "lucide-react";
import { DashboardCheckinButton } from "@/components/dashboard-checkin-button";
import { cn } from "@/lib/utils";

interface QuickAction {
  href: string;
  labelKey: string;
  descKey: string;
  icon: LucideIcon;
  accent: string;
}

const actions: QuickAction[] = [
  {
    href: "/trainings",
    labelKey: "training_label",
    descKey: "training_desc",
    icon: CalendarPlus,
    accent: "from-emerald-500/15 to-emerald-500/0 text-emerald-700"
  },
  {
    href: "/matches",
    labelKey: "match_label",
    descKey: "match_desc",
    icon: Trophy,
    accent: "from-amber-500/15 to-amber-500/0 text-amber-700"
  },
  {
    href: "/players",
    labelKey: "player_label",
    descKey: "player_desc",
    icon: UserPlus,
    accent: "from-sky-500/15 to-sky-500/0 text-sky-700"
  },
  {
    href: "/tactics",
    labelKey: "tactics_label",
    descKey: "tactics_desc",
    icon: Shield,
    accent: "from-violet-500/15 to-violet-500/0 text-violet-700"
  }
];

export async function DashboardQuickActions({
  players
}: {
  players: { id: string; name: string }[];
}) {
  const t = await getTranslations("quickactions");
  return (
    <section aria-label={t("aria")}>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <DashboardCheckinButton players={players} />
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
              href={action.href}
              key={action.href}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 -z-0 bg-gradient-to-br opacity-60 transition-opacity duration-200 group-hover:opacity-100",
                  action.accent
                )}
              />
              <span className="relative flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/80 text-foreground shadow-sm ring-1 ring-border/60"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold tracking-tight text-foreground">
                    {t(action.labelKey)}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
                    {t(action.descKey)}
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
