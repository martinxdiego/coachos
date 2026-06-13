// Pure FormData parsing/validation helpers shared by Server Actions.
// Kept dependency-free (no next/headers, no db) so they are unit-testable.

export function requiredString(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

export function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

export function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) {
    return null;
  }
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export function normalizeExternalUrl(rawUrl: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ||
    rawUrl.startsWith("/") ||
    rawUrl.includes(" ")
    ? rawUrl
    : `https://${rawUrl}`;
}

export function requiredRating(formData: FormData) {
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new Error("Rating must be between 1 and 10.");
  }
  return rating;
}

export function scaleFive(formData: FormData, key: string, label: string) {
  const value = Number(formData.get(key));
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be between 1 and 5.`);
  }
  return value;
}

export function optionalScaleFive(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(`${key} must be between 1 and 5.`);
  }
  return value;
}

export function enumValue<T extends string>(
  formData: FormData,
  key: string,
  allowed: readonly T[]
) {
  const value = String(formData.get(key) ?? "").trim();
  return allowed.includes(value as T) ? (value as T) : null;
}

export type PlayerStatusValue = "AVAILABLE" | "LIMITED" | "INJURED" | "ABSENT";

/**
 * Maps a UI / form status (lowercase, or a legacy value) onto the Prisma
 * PlayerStatus enum. The DB stores uppercase; the UI works in lowercase.
 */
export function toPlayerStatus(
  value: string | null | undefined
): PlayerStatusValue {
  switch ((value ?? "").toLowerCase()) {
    case "injured":
      return "INJURED";
    case "limited":
    case "rehab":
      return "LIMITED";
    case "absent":
      return "ABSENT";
    default:
      return "AVAILABLE";
  }
}
