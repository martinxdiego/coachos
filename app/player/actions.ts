"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  clearPlayerSessionCookie,
  getPlayerPortalSession
} from "@/lib/player-session";
import { recordAuditEvent } from "@/lib/audit";

export async function revokePlayerSession(formData: FormData) {
  const current = await getPlayerPortalSession();
  if (!current) redirect("/player/access");
  const sessionId = String(formData.get("session_id") ?? "");

  const result = await db.playerPortalSession.updateMany({
    where: { id: sessionId, playerId: current.playerId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  if (result.count !== 1) {
    throw new Error("Gerät wurde nicht gefunden.");
  }
  await recordAuditEvent({
    workspaceId: current.player.workspaceId,
    event: "player.session.revoked",
    actorPlayerId: current.playerId,
    targetType: "PlayerPortalSession",
    targetId: sessionId
  });

  if (sessionId === current.id) {
    await clearPlayerSessionCookie();
    redirect("/player/access");
  }
  revalidatePath("/player/security");
}

export async function revokeOtherPlayerSessions() {
  const current = await getPlayerPortalSession();
  if (!current) redirect("/player/access");

  await db.playerPortalSession.updateMany({
    where: {
      playerId: current.playerId,
      id: { not: current.id },
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    data: { revokedAt: new Date() }
  });
  await recordAuditEvent({
    workspaceId: current.player.workspaceId,
    event: "player.sessions.others_revoked",
    actorPlayerId: current.playerId,
    targetType: "PlayerPortalSession"
  });
  revalidatePath("/player/security");
}

export async function logoutPlayer() {
  const current = await getPlayerPortalSession();
  if (current) {
    await db.playerPortalSession.updateMany({
      where: { id: current.id, playerId: current.playerId },
      data: { revokedAt: new Date() }
    });
  }
  await clearPlayerSessionCookie();
  redirect("/player/access");
}
