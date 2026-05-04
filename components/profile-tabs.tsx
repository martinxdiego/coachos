"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ProfileTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  badge?: string | number;
}

export function ProfileTabs({
  tabs,
  defaultTab,
  className
}: {
  tabs: ProfileTab[];
  defaultTab?: string;
  className?: string;
}) {
  const [active, setActive] = useState<string>(defaultTab ?? tabs[0]?.id ?? "");
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div className={cn("space-y-5", className)}>
      <div
        aria-label="Profil-Tabs"
        className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-secondary/60 p-1 ring-1 ring-border/50"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              aria-controls={`tab-panel-${tab.id}`}
              aria-selected={isActive}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-medium tracking-tight transition-colors duration-200 ease-spring",
                isActive
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
              id={`tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActive(tab.id)}
              role="tab"
              type="button"
            >
              {tab.icon ?? null}
              {tab.label}
              {tab.badge !== undefined && tab.badge !== null && tab.badge !== "" ? (
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "bg-card text-muted-foreground"
                  )}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`tab-${activeTab?.id}`}
        id={`tab-panel-${activeTab?.id}`}
        role="tabpanel"
      >
        {activeTab?.content}
      </div>
    </div>
  );
}
