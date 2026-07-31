import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const STAFF_INVITE_ROLES = ["coach", "assistant"] as const;
const MAX_TRANSACTION_ATTEMPTS = 3;

type StaffInviteRole = (typeof STAFF_INVITE_ROLES)[number];
type MembershipRole = "COACH" | "ASSISTANT";

export type StaffInviteTransaction = Pick<
  Prisma.TransactionClient,
  "teamInvite" | "workspaceMember"
>;

export interface StaffInviteDatabase {
  $transaction<T>(
    callback: (transaction: StaffInviteTransaction) => Promise<T>,
    options: { isolationLevel: "Serializable" }
  ): Promise<T>;
}

const defaultDatabase = db as unknown as StaffInviteDatabase;

function membershipRole(role: StaffInviteRole): MembershipRole {
  return role === "coach" ? "COACH" : "ASSISTANT";
}

function isStaffInviteRole(role: string): role is StaffInviteRole {
  return (STAFF_INVITE_ROLES as readonly string[]).includes(role);
}

function isSerializationFailure(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "P2034"
  );
}

async function redeemInTransaction(
  transaction: StaffInviteTransaction,
  userId: string,
  code: string,
  now: Date
): Promise<string> {
  const invite = await transaction.teamInvite.findUnique({
    where: { code },
    select: {
      id: true,
      workspaceId: true,
      role: true,
      expiresAt: true,
      usedAt: true
    }
  });

  // Player self-registration links share the table but must never grant a
  // staff membership, even if a generated code happens to be all-uppercase.
  if (!invite || !isStaffInviteRole(invite.role)) {
    throw new Error("Ungültiger Einladungscode.");
  }
  if (invite.expiresAt <= now) {
    throw new Error("Dieser Einladungscode ist abgelaufen.");
  }
  if (invite.usedAt) {
    throw new Error("Dieser Einladungscode wurde bereits verwendet.");
  }

  const existingMember = await transaction.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invite.workspaceId,
        userId
      }
    },
    select: { id: true }
  });

  // Re-entering a code for a workspace the user already belongs to is a
  // harmless no-op and must not burn the single-use invite for its recipient.
  if (existingMember) {
    return invite.workspaceId;
  }

  // Compare-and-set is the single-use boundary. Two concurrent transactions
  // may both read the row, but only one can transition usedAt from null.
  const claimed = await transaction.teamInvite.updateMany({
    where: {
      id: invite.id,
      role: { in: [...STAFF_INVITE_ROLES] },
      usedAt: null,
      expiresAt: { gt: now }
    },
    data: { usedAt: now }
  });

  if (claimed.count !== 1) {
    throw new Error("Dieser Einladungscode wurde bereits verwendet.");
  }

  await transaction.workspaceMember.create({
    data: {
      workspaceId: invite.workspaceId,
      userId,
      role: membershipRole(invite.role)
    }
  });

  return invite.workspaceId;
}

export async function redeemStaffInviteWithDatabase(
  database: StaffInviteDatabase,
  userId: string,
  rawCode: string
): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  let lastSerializationFailure: unknown;

  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(
        (transaction) =>
          redeemInTransaction(transaction, userId, code, new Date()),
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      lastSerializationFailure = error;
    }
  }

  throw lastSerializationFailure ?? new Error("Einladung konnte nicht eingelöst werden.");
}

export async function redeemStaffInvite(
  userId: string,
  code: string
): Promise<string> {
  return redeemStaffInviteWithDatabase(defaultDatabase, userId, code);
}
