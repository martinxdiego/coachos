"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { MoreNavSheet } from "@/components/more-nav-sheet";
import { isActiveHref, primaryMobileNav } from "@/components/nav-config";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="glass fixed inset-x-3 bottom-3 z-40 rounded-2xl border p-1.5 shadow-elevated md:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        <div className="grid grid-cols-5 gap-1">
          {primaryMobileNav.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveHref(pathname, item.href);

            return (
              <Link
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium tracking-tight transition-colors duration-200 ease-spring active:scale-95",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}

          <button
            aria-label="Mehr Bereiche"
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium tracking-tight text-muted-foreground transition-colors duration-200 ease-spring hover:text-foreground active:scale-95"
            onClick={() => setShowMore(true)}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="h-[18px] w-[18px]" />
            Mehr
          </button>
        </div>
      </nav>

      <MoreNavSheet isOpen={showMore} onClose={() => setShowMore(false)} />
    </>
  );
}
