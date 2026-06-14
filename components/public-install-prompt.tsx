"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PublicInstallPrompt() {
  const t = useTranslations("install");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (ios) setVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  }

  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-indigo-500/0 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30">
        <Download aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold tracking-tight text-foreground">
          {t("title")}
        </span>
        {isIOS ? (
          <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">
            {t("ios_pre")}{" "}
            <strong className="text-foreground/80">
              {t("ios_share")}
            </strong>{" "}
            {t("ios_then")}{" "}
            <strong className="text-foreground/80">
              {t("ios_add")}
            </strong>
          </span>
        ) : (
          <button
            className="mt-0.5 block text-left text-[12px] leading-5 text-indigo-600 underline-offset-2 hover:underline"
            onClick={install}
            type="button"
          >
            {t("add_to_home")}
          </button>
        )}
      </span>
      <button
        aria-label={t("close")}
        className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible(false)}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
