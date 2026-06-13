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

function emit(level: Level, message: string, fields?: LogFields): void {
  const line = JSON.stringify({
    level,
    message,
    ...fields,
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
