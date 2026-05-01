"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useOpenMoreNav } from "@/components/more-nav-provider";
import { isActiveHref, primaryDesktopNav } from "@/components/nav-config";
import { cn } from "@/lib/utils";

export function AppNav() {
  const pathname = usePathname();
  const openMore = useOpenMoreNav();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="flex items-center gap-1 rounded-full bg-white/8 p-1 ring-1 ring-white/10 backdrop-blur"
    >
      {primaryDesktopNav.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveHref(pathname, item.href);

        return (
          <Link
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium tracking-tight text-slate-300 transition-colors duration-200 ease-spring hover:text-white",
              isActive &&
                "bg-white text-slate-950 shadow-soft hover:text-slate-950"
            )}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}

      <button
        aria-label="Mehr Bereiche"
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium tracking-tight text-slate-300 transition-colors duration-200 ease-spring hover:text-white active:scale-95"
        onClick={openMore}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        Mehr
      </button>
    </nav>
  );
}
