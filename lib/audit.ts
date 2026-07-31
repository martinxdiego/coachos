import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface AuditEventInput {
  workspaceId: string;
  event: string;
  actorUserId?: string;
  actorPlayerId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

export async function recordAuditEvent(
  input: AuditEventInput,
  writer: AuditWriter = db
) {
  await writer.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      event: input.event,
      actorUserId: input.actorUserId,
      actorPlayerId: input.actorPlayerId,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata
    }
  });
}
