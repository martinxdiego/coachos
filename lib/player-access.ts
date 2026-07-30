import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Rotating a bearer link must revoke every delivery channel that could reveal
 * the replacement token. Both changes commit atomically.
 */
export async function rotatePlayerTokenAndRevokePush(playerId: string) {
  const nextAccessToken = randomUUID();

  await db.$transaction([
    db.pushSubscription.deleteMany({ where: { playerId } }),
    db.playerPortalSession.deleteMany({ where: { playerId } }),
    db.player.update({
      where: { id: playerId },
      data: { accessToken: nextAccessToken }
    })
  ]);

  return nextAccessToken;
}
