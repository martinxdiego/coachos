import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("Health check failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
    return NextResponse.json(
      { ok: false },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
