import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  );
}

async function run(request: Request) {
  if (!authorized(request)) {
    return response({ error: "Unauthorized" }, 401);
  }

  try {
    const workspaces = await db.workspace.findMany({
      select: {
        id: true,
        dataRetentionDays: true,
        healthRetentionDays: true
      }
    });
    const totals = {
      workspaces: workspaces.length,
      healthChecks: 0,
      feedback: 0,
      coachMessages: 0,
      auditLogs: 0,
      playerSessions: 0,
      passwordResetTokens: 0,
      emailVerificationTokens: 0
    };

    for (const workspace of workspaces) {
      const now = Date.now();
      const healthBefore = new Date(
        now - workspace.healthRetentionDays * 24 * 60 * 60 * 1000
      );
      const dataBefore = new Date(
        now - workspace.dataRetentionDays * 24 * 60 * 60 * 1000
      );
      const [healthChecks, feedback, coachMessages, auditLogs] =
        await db.$transaction([
          db.healthCheck.deleteMany({
            where: {
              player: { workspaceId: workspace.id },
              date: { lt: healthBefore }
            }
          }),
          db.playerFeedback.deleteMany({
            where: {
              workspaceId: workspace.id,
              createdAt: { lt: dataBefore }
            }
          }),
          db.coachMessage.deleteMany({
            where: {
              workspaceId: workspace.id,
              createdAt: { lt: dataBefore }
            }
          }),
          db.auditLog.deleteMany({
            where: {
              workspaceId: workspace.id,
              createdAt: { lt: dataBefore }
            }
          })
        ]);
      totals.healthChecks += healthChecks.count;
      totals.feedback += feedback.count;
      totals.coachMessages += coachMessages.count;
      totals.auditLogs += auditLogs.count;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const orphanAuditBefore = new Date(
      now.getTime() - 730 * 24 * 60 * 60 * 1000
    );
    const [
      playerSessions,
      passwordResetTokens,
      emailVerificationTokens,
      orphanAuditLogs
    ] = await db.$transaction([
      db.playerPortalSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { revokedAt: { lt: oneDayAgo } }
          ]
        }
      }),
      db.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { lt: oneDayAgo } }
          ]
        }
      }),
      db.emailVerificationToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { usedAt: { lt: oneDayAgo } }
          ]
        }
      }),
      db.auditLog.deleteMany({
        where: {
          workspaceId: { notIn: workspaces.map((workspace) => workspace.id) },
          createdAt: { lt: orphanAuditBefore }
        }
      })
    ]);
    totals.playerSessions = playerSessions.count;
    totals.passwordResetTokens = passwordResetTokens.count;
    totals.emailVerificationTokens = emailVerificationTokens.count;
    totals.auditLogs += orphanAuditLogs.count;

    return response(totals);
  } catch (error) {
    logger.error("Data retention job failed", {
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
    return response({ error: "Data retention job failed" }, 500);
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
