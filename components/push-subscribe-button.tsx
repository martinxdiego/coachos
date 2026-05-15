"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PushSubscribeButtonProps {
  playerId: string;
  playerUrl: string;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = "idle" | "loading" | "subscribed" | "denied" | "unsupported";

export function PushSubscribeButton({ playerId, playerUrl }: PushSubscribeButtonProps) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setStatus("subscribed");
      });
    });
  }, []);

  async function subscribe() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast.error("Push-Benachrichtigungen sind nicht konfiguriert.");
      return;
    }
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, playerId, playerUrl }),
      });
      if (!res.ok) throw new Error();
      setStatus("subscribed");
      toast.success("Tägliche Erinnerungen aktiviert! 🔔");
    } catch {
      setStatus("idle");
      toast.error("Benachrichtigungen konnten nicht aktiviert werden.");
    }
  }

  if (status === "unsupported") return null;

  const isDisabled = status === "subscribed" || status === "loading" || status === "denied";

  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-violet-500/0 p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-violet-500/60 hover:shadow-elevated disabled:translate-y-0 disabled:cursor-default disabled:opacity-70"
      disabled={isDisabled}
      onClick={subscribe}
      type="button"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/30">
        {status === "loading" ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : status === "subscribed" ? (
          <Bell aria-hidden="true" className="h-5 w-5" />
        ) : (
          <BellOff aria-hidden="true" className="h-5 w-5" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold tracking-tight text-foreground">
          {status === "subscribed"
            ? "Benachrichtigungen aktiv"
            : status === "denied"
              ? "Benachrichtigungen blockiert"
              : "Tägliche Erinnerung aktivieren"}
        </span>
        <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
          {status === "subscribed"
            ? "Du erhältst jeden Morgen eine Erinnerung zum Check-in"
            : status === "denied"
              ? "Benachrichtigungen in den Browser-Einstellungen erlauben"
              : "Jeden Morgen eine Push-Nachricht für den Wellness-Check"}
        </span>
      </span>
    </button>
  );
}
