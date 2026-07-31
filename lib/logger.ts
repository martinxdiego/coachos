// Minimal structured logger. Emits one JSON line per event so logs are
// greppable/queryable in production, and exposes a single seam
// (registerErrorSink) for forwarding errors to an external monitor such as
// Sentry — wired in instrumentation, see docs/observability.md.
//
// PII DISCIPLINE: never put emails, names, tokens, or health data in `fields`.
// Use stable ids (workspaceId, playerId) instead.

type Level = "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

type ErrorSink = (error: unknown, fields?: LogFields) => void;

let errorSink: ErrorSink | null = null;

/** Registers an external error reporter (e.g. Sentry.captureException). */
export function registerErrorSink(sink: ErrorSink): void {
  errorSink = sink;
}

/**
 * Removes common secrets and personal data from log messages. Structured
 * fields still have to follow the PII discipline documented above.
 */
export function redactSensitiveText(value: string): string {
  return value
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]"
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[redacted-id]"
    )
    .replace(/\/(p|join)\/[^/?#\s]+/gi, "/$1/[redacted]")
    .replace(
      /([?&](?:access_?token|token|code|email|key|secret)=)[^&#\s]+/gi,
      "$1[redacted]"
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

function emit(level: Level, message: string, fields?: LogFields): void {
  const line = JSON.stringify({
    ...fields,
    level,
    message: redactSensitiveText(message),
    time: new Date().toISOString(),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

/**
 * Logs an error and forwards it to the registered sink (if any). Returns the
 * error's digest-friendly message; safe to call from anywhere.
 */
export function captureException(error: unknown, fields?: LogFields): void {
  const message = error instanceof Error ? error.message : String(error);
  emit("error", message, fields);
  try {
    errorSink?.(error, fields);
  } catch {
    // A broken sink must never crash the caller.
  }
}
