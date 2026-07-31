import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const PLAYER_SESSION_COOKIE = "coachos-player-session";
export const PLAYER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hashPlayerSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function playerDeviceLabel(userAgent: string | null): string {
  const value = userAgent ?? "";
  const device = /iPad/i.test(value)
    ? "iPad"
    : /iPhone/i.test(value)
      ? "iPhone"
      : /Android/i.test(value)
        ? "Android"
        : /Windows/i.test(value)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(value)
            ? "Mac"
            : "Gerät";
  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /Firefox\//i.test(value)
      ? "Firefox"
      : /CriOS|Chrome\//i.test(value)
        ? "Chrome"
        : /Safari\//i.test(value)
          ? "Safari"
          : "Browser";
  return `${device} · ${browser}`;
}

export function playerSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PLAYER_SESSION_MAX_AGE_SECONDS
  };
}

export async function issuePlayerSession(
  playerId: string,
  userAgent: string | null
) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashPlayerSessionToken(token);
  const expiresAt = new Date(
    Date.now() + PLAYER_SESSION_MAX_AGE_SECONDS * 1000
  );
  const userAgentHash = userAgent
    ? createHash("sha256").update(userAgent).digest("hex")
    : null;

  const session = await db.$transaction(async (tx) => {
    await tx.playerPortalSession.deleteMany({
      where: {
        playerId,
        OR: [
          { expiresAt: { lte: new Date() } },
          { revokedAt: { not: null } }
        ]
      }
    });
    return tx.playerPortalSession.create({
      data: {
        playerId,
        tokenHash,
        deviceLabel: playerDeviceLabel(userAgent),
        userAgentHash,
        expiresAt
      },
      select: { id: true, expiresAt: true }
    });
  });

  return { token, ...session };
}

export async function getPlayerPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLAYER_SESSION_COOKIE)?.value;
  if (!token || token.length < 32 || token.length > 128) return null;

  const session = await db.playerPortalSession.findUnique({
    where: { tokenHash: hashPlayerSessionToken(token) },
    select: {
      id: true,
      playerId: true,
      deviceLabel: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      player: {
        select: {
          id: true,
          workspaceId: true,
          name: true,
          accessToken: true
        }
      }
    }
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  if (Date.now() - session.lastUsedAt.getTime() > 60 * 60 * 1000) {
    await db.playerPortalSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastUsedAt: new Date() }
    });
  }
  return session;
}

export async function clearPlayerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(PLAYER_SESSION_COOKIE);
}
