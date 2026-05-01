"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { MoreNavSheet } from "@/components/more-nav-sheet";

const MoreNavContext = createContext<(() => void) | null>(null);

export function MoreNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <MoreNavContext.Provider value={open}>
      {children}
      <MoreNavSheet isOpen={isOpen} onClose={close} />
    </MoreNavContext.Provider>
  );
}

export function useOpenMoreNav() {
  const open = useContext(MoreNavContext);
  if (!open) {
    throw new Error("useOpenMoreNav must be used inside MoreNavProvider");
  }
  return open;
}
