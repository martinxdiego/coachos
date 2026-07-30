"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status =
  | "idle"
  | "loading"
  | "subscribed"
  | "conflict"
  | "limit"
  | "denied"
  | "unsupported";

function persistSubscription(
  subscription: PushSubscription,
  replaceExisting = false
) {
  return fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription,
      replaceExisting
    })
  });
}

async function subscriptionConflictCode(
  response: Response
): Promise<"subscription_conflict" | "device_limit" | null> {
  if (response.status !== 409) return null;
  const body = await response.json().catch(() => null);
  return body?.code === "device_limit"
    ? "device_limit"
    : "subscription_conflict";
}

export function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let active = true;
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus("unsupported");
      return () => {
        active = false;
      };
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return () => {
        active = false;
      };
    }

    async function syncExistingSubscription() {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || !active) return;

      const response = await persistSubscription(subscription).catch(() => null);
      if (!active) return;

      if (response?.status === 409) {
        const code = await subscriptionConflictCode(response);
        setStatus(code === "device_limit" ? "limit" : "conflict");
      } else if (response?.ok) {
        setStatus("subscribed");
      }
    }

    void syncExistingSubscription();
    return () => {
      active = false;
    };
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
      let subscription = await reg.pushManager.getSubscription();
      let createdLocally = false;
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        createdLocally = true;
      }

      const res = await persistSubscription(subscription);
      if (res.status === 409) {
        const code = await subscriptionConflictCode(res);
        if (code === "device_limit") {
          setStatus("limit");
          toast.error(
            "Das Limit aktiver Geräte ist erreicht. Deaktiviere zuerst ein altes Gerät."
          );
        } else {
          setStatus("conflict");
          toast.error(
            "Dieses Gerät ist bereits mit einem anderen Spielerprofil verknüpft."
          );
        }
        return;
      }
      if (!res.ok) {
        if (createdLocally) {
          await subscription.unsubscribe().catch(() => false);
        }
        throw new Error();
      }
      setStatus("subscribed");
      toast.success("Tägliche Erinnerungen aktiviert! 🔔");
    } catch {
      setStatus("idle");
      toast.error("Benachrichtigungen konnten nicht aktiviert werden.");
    }
  }

  async function replaceSubscription() {
    const confirmed = window.confirm(
      "Erinnerungen auf dieses Profil umstellen? Das bisher auf diesem Gerät verknüpfte Profil erhält danach keine Erinnerungen mehr."
    );
    if (!confirmed) return;

    setStatus("loading");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setStatus("idle");
        toast.error("Keine aktive Browser-Subscription gefunden.");
        return;
      }

      const response = await persistSubscription(subscription, true);
      if (response.status === 409) {
        const code = await subscriptionConflictCode(response);
        if (code === "device_limit") {
          setStatus("limit");
          toast.error(
            "Das Limit aktiver Geräte ist erreicht. Deaktiviere zuerst ein altes Gerät."
          );
        } else {
          setStatus("conflict");
          toast.error(
            "Die Verknüpfung wurde zwischenzeitlich geändert. Bitte erneut versuchen."
          );
        }
        return;
      }
      if (!response.ok) throw new Error();

      setStatus("subscribed");
      toast.success("Erinnerungen wurden auf dieses Profil umgestellt.");
    } catch {
      setStatus("conflict");
      toast.error("Erinnerungen konnten nicht umgestellt werden.");
    }
  }

  async function unsubscribe() {
    setStatus("loading");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setStatus("idle");
        return;
      }

      const response = await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });
      if (!response.ok) throw new Error();

      await subscription.unsubscribe();
      setStatus("idle");
      toast.success("Tägliche Erinnerungen deaktiviert.");
    } catch {
      setStatus("subscribed");
      toast.error("Benachrichtigungen konnten nicht deaktiviert werden.");
    }
  }

  if (status === "unsupported") return null;

  const isDisabled =
    status === "loading" || status === "denied" || status === "limit";

  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-violet-500/0 p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-violet-500/60 hover:shadow-elevated disabled:translate-y-0 disabled:cursor-default disabled:opacity-70"
      disabled={isDisabled}
      onClick={
        status === "subscribed"
          ? unsubscribe
          : status === "conflict"
            ? replaceSubscription
            : subscribe
      }
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
      <span aria-live="polite" className="min-w-0">
        <span className="block text-[14px] font-semibold tracking-tight text-foreground">
          {status === "subscribed"
            ? "Benachrichtigungen deaktivieren"
            : status === "conflict"
              ? "Bereits mit anderem Profil verknüpft"
            : status === "limit"
              ? "Gerätelimit erreicht"
            : status === "denied"
              ? "Benachrichtigungen blockiert"
              : "Tägliche Erinnerung aktivieren"}
        </span>
        <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
          {status === "subscribed"
            ? "Du erhältst Erinnerungen · tippen zum Abmelden"
            : status === "conflict"
              ? "Tippen, um Erinnerungen ausdrücklich auf dieses Profil umzustellen"
            : status === "limit"
              ? "Deaktiviere Push zuerst auf einem alten Gerät"
            : status === "denied"
              ? "Benachrichtigungen in den Browser-Einstellungen erlauben"
              : "Jeden Morgen eine Push-Nachricht für den Wellness-Check"}
        </span>
      </span>
    </button>
  );
}
