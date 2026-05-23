"use client";

import { useEffect, useState } from "react";
import { getLocale, setLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const [locale, setLocaleState] = useState("de");

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  const handleToggle = () => {
    const nextLocale = locale === "de" ? "en" : "de";
    setLocale(nextLocale);
  };

  return (
    <Button
      onClick={handleToggle}
      size="sm"
      variant="ghost"
      className="flex items-center gap-2 text-slate-300 hover:bg-slate-800 hover:text-white"
    >
      <Globe className="h-4 w-4" />
      <span className="text-xs font-semibold uppercase">{locale}</span>
    </Button>
  );
}
