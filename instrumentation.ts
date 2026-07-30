import { captureException, logger } from "@/lib/logger";
import { sanitizeRouteLabel } from "@/lib/observability";

type RequestErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

type RequestErrorRequest = {
  method: string;
  path: string;
};

export async function register() {
  logger.info("Application runtime initialized", {
    runtime: process.env.NEXT_RUNTIME ?? "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
  });
}

export async function onRequestError(
  error: unknown,
  request: Readonly<RequestErrorRequest>,
  context: Readonly<RequestErrorContext>
) {
  captureException(error, {
    method: request.method,
    route: sanitizeRouteLabel(context.routePath || request.path),
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
}
