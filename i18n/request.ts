import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const SUPPORTED_LOCALES = ["de", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "de";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = SUPPORTED_LOCALES.includes(
    cookieLocale as AppLocale
  )
    ? (cookieLocale as AppLocale)
    : DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // Lenient like the old custom t(): show the key instead of throwing or
    // logging when a translation is missing, so a gap never breaks rendering.
    getMessageFallback: ({ key }) => key,
    onError: () => {}
  };
});
