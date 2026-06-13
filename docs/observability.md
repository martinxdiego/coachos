# Observability (S4.3)

## Structured logging

Use `lib/logger.ts` instead of raw `console.*`:

```ts
import { logger, captureException } from "@/lib/logger";

logger.info("training created", { workspaceId, trainingId });
logger.warn("redis unavailable, using in-memory fallback");
captureException(err, { boundary: "app" });
```

Every call emits one JSON line (`{ level, message, ...fields, time }`),
which is greppable and queryable in production log drains.

**PII discipline:** never log emails, names, tokens, or health data. Use
stable ids (`workspaceId`, `playerId`). The auth layer already follows this
(no cleartext email in failure logs).

## Error monitoring (Sentry) — environment step

`captureException()` forwards to a sink registered via `registerErrorSink`.
Wiring Sentry is a one-time env/infra step (needs a DSN), kept out of the
repo so the build stays dependency-light:

1. `npm i @sentry/nextjs`
2. Add `instrumentation.ts` at the project root:

   ```ts
   import * as Sentry from "@sentry/nextjs";
   import { registerErrorSink } from "@/lib/logger";

   export function register() {
     if (!process.env.SENTRY_DSN) return;
     Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
     registerErrorSink((error) => Sentry.captureException(error));
   }
   ```

3. Add client config (`sentry.client.config.ts`) per the Sentry Next.js
   guide and set `SENTRY_DSN` in Vercel.

Until then, `captureException` logs the error (and the S4.4 error
boundaries call it), so nothing is lost — errors just aren't aggregated
externally yet.
