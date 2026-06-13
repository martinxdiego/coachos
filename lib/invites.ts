import { randomBytes } from "crypto";
import { db } from "@/lib/db";

const PLAYER_SIGNUP_ROLE = "PLAYER";
const SIGNUP_INVITE_TTL_DAYS = 90;

/** Generates a short, URL-safe, hard-to-guess invite code. */
export function generateInviteCode(): string {
  return randomBytes(12).toString("base64url");
}

function expiryFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export interface PlayerSignupInvite {
  code: string;
  expiresAt: Date;
}

/**
 * Returns the workspace's active, reusable player-signup invite, creating one if
 * none exists or the previous one has expired. This is the only valid token for
 * the public /join flow — the old "workspace id as token" path is gone.
 */
export async function getOrCreatePlayerSignupInvite(
  workspaceId: string,
  userId: string
): Promise<PlayerSignupInvite> {
  const existing = await db.teamInvite.findFirst({
    where: {
      workspaceId,
      role: PLAYER_SIGNUP_ROLE,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { code: true, expiresAt: true },
  });
  if (existing) return existing;

  const created = await db.teamInvite.create({
    data: {
      workspaceId,
      code: generateInviteCode(),
      role: PLAYER_SIGNUP_ROLE,
      createdBy: userId,
      expiresAt: expiryFromNow(SIGNUP_INVITE_TTL_DAYS),
    },
    select: { code: true, expiresAt: true },
  });
  return created;
}

/**
 * Revokes all current player-signup invites for the workspace and issues a fresh
 * one — any previously shared link stops working immediately.
 */
export async function rotatePlayerSignupInvite(
  workspaceId: string,
  userId: string
): Promise<PlayerSignupInvite> {
  await db.teamInvite.deleteMany({
    where: { workspaceId, role: PLAYER_SIGNUP_ROLE },
  });
  const created = await db.teamInvite.create({
    data: {
      workspaceId,
      code: generateInviteCode(),
      role: PLAYER_SIGNUP_ROLE,
      createdBy: userId,
      expiresAt: expiryFromNow(SIGNUP_INVITE_TTL_DAYS),
    },
    select: { code: true, expiresAt: true },
  });
  return created;
}

export interface ResolvedSignupInvite {
  workspaceId: string;
  workspaceName: string;
  ageGroup: string | null;
  season: string | null;
}

/**
 * Resolves a public signup code to its workspace, or null if the code is
 * unknown, expired, or already consumed. Never accepts a raw workspace id.
 */
export async function resolvePlayerSignupInvite(
  code: string
): Promise<ResolvedSignupInvite | null> {
  const invite = await db.teamInvite.findUnique({
    where: { code },
    select: {
      role: true,
      usedAt: true,
      expiresAt: true,
      workspace: {
        select: { id: true, name: true, ageGroup: true, season: true },
      },
    },
  });

  if (
    !invite ||
    invite.role !== PLAYER_SIGNUP_ROLE ||
    invite.usedAt !== null ||
    invite.expiresAt <= new Date()
  ) {
    return null;
  }

  return {
    workspaceId: invite.workspace.id,
    workspaceName: invite.workspace.name,
    ageGroup: invite.workspace.ageGroup,
    season: invite.workspace.season,
  };
}
