"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";

type ConnectionState = "online" | "offline" | "restored";

export function OfflineStatusBanner() {
  const [state, setState] = useState<ConnectionState>("online");
  const wasOffline = useRef(false);

  useEffect(() => {
    let restoredTimer: ReturnType<typeof setTimeout> | undefined;

    const handleOffline = () => {
      if (restoredTimer) clearTimeout(restoredTimer);
      wasOffline.current = true;
      setState("offline");
    };
    const handleOnline = () => {
      if (!wasOffline.current) {
        setState("online");
        return;
      }
      setState("restored");
      restoredTimer = setTimeout(() => setState("online"), 3000);
    };

    if (!navigator.onLine) handleOffline();
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      if (restoredTimer) clearTimeout(restoredTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (state === "online") return null;

  const restored = state === "restored";
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-3 right-24 z-[45] flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-medium shadow-lg md:bottom-5 md:left-1/2 md:right-auto md:w-[min(36rem,calc(100vw-2rem))] md:-translate-x-1/2 md:justify-center md:text-center ${
        restored
          ? "bg-emerald-600 text-white"
          : "bg-amber-500 text-amber-950"
      }`}
      role="status"
    >
      {restored ? (
        <Wifi aria-hidden="true" className="h-4 w-4" />
      ) : (
        <CloudOff aria-hidden="true" className="h-4 w-4" />
      )}
      {restored
        ? "Verbindung wiederhergestellt"
        : "Offline – Änderungen können derzeit nicht gespeichert werden"}
    </div>
  );
}
