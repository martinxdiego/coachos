const PRIVATE_ROUTE_PATTERNS = [
  [/^\/p\/[^/?#]+/i, "/p/[redacted]"],
  [/^\/join\/[^/?#]+/i, "/join/[redacted]"],
] as const;

/**
 * Produces a low-cardinality route label without bearer-style URL tokens or
 * query parameters. Use this label for logs, traces and error monitoring.
 */
export function sanitizeRouteLabel(path: string | undefined): string {
  if (!path) return "unknown";

  const route = path.split(/[?#]/, 1)[0] || "/";
  return PRIVATE_ROUTE_PATTERNS.reduce(
    (current, [pattern, replacement]) =>
      current.replace(pattern, replacement),
    route
  ).slice(0, 200);
}
