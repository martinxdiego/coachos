// Sanitises text into a safe ASCII filename slug. We keep it conservative
// because Content-Disposition + browser download flows behave inconsistently
// with non-ASCII characters across OSes.
export function safeFilename(parts: (string | number | null | undefined)[]): string {
  const cleaned = parts
    .map((part) => (part === null || part === undefined ? "" : String(part)))
    .map((part) =>
      part
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "") // strip diacritics
        .replace(/[^a-zA-Z0-9-_ ]+/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase()
    )
    .filter(Boolean);

  const joined = cleaned.join("-").replace(/-+/g, "-").slice(0, 80);
  return joined || "coachos-export";
}

export function pdfDateString() {
  const now = new Date();
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
}
