/**
 * Creates a deterministic Redis/cache key without storing the original
 * identifier (for example an e-mail address or IP address) in infrastructure.
 * This is not password hashing; it is pseudonymisation for operational keys.
 */
export async function opaqueKey(
  namespace: string,
  identifier: string
): Promise<string> {
  const payload = new TextEncoder().encode(
    `${namespace}\u0000${identifier}`
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `${namespace}:${hex}`;
}
