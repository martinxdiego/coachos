"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { MoreNavSheet } from "@/components/more-nav-sheet";
import type { NavCluster } from "@/components/nav-config";

interface MoreNavContextValue {
  openCluster: (cluster: NavCluster) => void;
}

const MoreNavContext = createContext<MoreNavContextValue | null>(null);

export function MoreNavProvider({ children }: { children: React.ReactNode }) {
  const [activeCluster, setActiveCluster] = useState<NavCluster | null>(null);

  const openCluster = useCallback((cluster: NavCluster) => {
    setActiveCluster(cluster);
  }, []);

  const close = useCallback(() => setActiveCluster(null), []);

  return (
    <MoreNavContext.Provider value={{ openCluster }}>
      {children}
      <MoreNavSheet
        cluster={activeCluster}
        isOpen={activeCluster !== null}
        onClose={close}
      />
    </MoreNavContext.Provider>
  );
}

export function useOpenCluster() {
  const ctx = useContext(MoreNavContext);
  if (!ctx) {
    throw new Error("useOpenCluster must be used inside MoreNavProvider");
  }
  return ctx.openCluster;
}
