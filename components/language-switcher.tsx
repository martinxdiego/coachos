"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextLocale = locale === "de" ? "en" : "de";
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;
    startTransition(() => router.refresh());
  };

  return (
    <Button
      aria-label={locale === "de" ? "Sprache wechseln zu Englisch" : "Switch language to German"}
      onClick={handleToggle}
      disabled={isPending}
      size="sm"
      variant="ghost"
      className="flex items-center gap-2 text-slate-300 hover:bg-slate-800 hover:text-white"
    >
      <Globe aria-hidden="true" className="h-4 w-4" />
      <span className="text-xs font-semibold uppercase">{locale}</span>
    </Button>
  );
}
