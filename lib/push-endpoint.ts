const TRUSTED_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

/**
 * Web Push causes a later server-side request to the stored endpoint. Limit
 * endpoints to the mainstream browser push services to prevent the public
 * subscription route from becoming an SSRF primitive.
 */
export function isTrustedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname.toLowerCase();
    const trustedHost =
      TRUSTED_PUSH_HOSTS.has(hostname) ||
      hostname.endsWith(".notify.windows.com");

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.port === "" || url.port === "443") &&
      trustedHost
    );
  } catch {
    return false;
  }
}
