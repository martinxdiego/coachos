"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOpenCluster } from "@/components/more-nav-provider";
import {
  getNavKey,
  isClusterActive,
  mobileNavClusters
} from "@/components/nav-config";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

export function MobileBottomNav({ enabled }: { enabled: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const openCluster = useOpenCluster();

  if (!enabled) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile Navigation"
      className="glass fixed inset-x-3 bottom-3 z-40 rounded-2xl border p-1.5 shadow-elevated md:hidden"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-5 gap-1">
        {mobileNavClusters.map((cluster) => {
          const Icon = cluster.icon;
          const isActive = isClusterActive(pathname, cluster);

          if (cluster.href) {
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium tracking-tight transition-colors duration-200 ease-spring active:scale-95",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
                href={cluster.href}
                key={cluster.id}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                {t(getNavKey(cluster.id))}
              </Link>
            );
          }

          return (
            <button
              aria-label={
                locale === "de"
                  ? `${t(getNavKey(cluster.id))} öffnen`
                  : `Open ${t(getNavKey(cluster.id))}`
              }
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium tracking-tight transition-colors duration-200 ease-spring active:scale-95",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={cluster.id}
              onClick={() => openCluster(cluster)}
              type="button"
            >
              <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
              {t(getNavKey(cluster.id))}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-primary"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
