import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { drainStorageDeletionQueue } from "@/lib/storage-deletion-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

async function runRetention(request: Request) {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await drainStorageDeletionQueue({ limit: 50 });
    return json({ ...result });
  } catch (error) {
    logger.error("Private storage retention job failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
    return json({ error: "Storage retention job failed" }, 500);
  }
}

// Vercel Cron invokes GET. POST remains available for the authenticated
// operational runbook and does not accept user-controlled queue parameters.
export async function GET(request: Request) {
  return runRetention(request);
}

export async function POST(request: Request) {
  return runRetention(request);
}
