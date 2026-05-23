import de from "../messages/de.json";
import en from "../messages/en.json";

const translations: Record<string, any> = { de, en };

export function getLocale(): string {
  if (typeof window !== "undefined") {
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    return match ? match[1] : "de";
  }

  try {
    const { cookies } = require("next/headers");
    const cookieStore = cookies();
    return cookieStore.get("NEXT_LOCALE")?.value || "de";
  } catch {
    return "de";
  }
}

export function t(key: string, fallback?: string): string {
  const locale = getLocale();
  const dict = translations[locale] || translations.de;

  const keys = key.split(".");
  let value = dict;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return fallback || key;
    }
  }

  return typeof value === "string" ? value : fallback || key;
}

export function setLocale(locale: string): void {
  if (typeof window !== "undefined") {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    window.location.reload();
  }
}
