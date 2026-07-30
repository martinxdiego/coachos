import { describe, expect, it, vi } from "vitest";
import {
  redeemStaffInviteWithDatabase,
  type StaffInviteDatabase,
  type StaffInviteTransaction
} from "./staff-invites";

interface MutableInvite {
  id: string;
  workspaceId: string;
  code: string;
  role: string;
  expiresAt: Date;
  usedAt: Date | null;
}

interface Membership {
  id: string;
  workspaceId: string;
  userId: string;
  role: "COACH" | "ASSISTANT";
}

function createInviteDatabase(invite: MutableInvite) {
  const memberships: Membership[] = [];

  const transaction = {
    teamInvite: {
      findUnique: vi.fn(async ({ where }: { where: { code: string } }) => {
        if (where.code !== invite.code) return null;
        return {
          id: invite.id,
          workspaceId: invite.workspaceId,
          role: invite.role,
          expiresAt: invite.expiresAt,
          usedAt: invite.usedAt
        };
      }),
      updateMany: vi.fn(
        async ({
          where,
          data
        }: {
          where: {
            id: string;
            role: { in: string[] };
            usedAt: null;
            expiresAt: { gt: Date };
          };
          data: { usedAt: Date };
        }) => {
          const claimable =
            invite.id === where.id &&
            where.role.in.includes(invite.role) &&
            invite.usedAt === null &&
            invite.expiresAt > where.expiresAt.gt;
          if (!claimable) return { count: 0 };

          // Synchronous state transition models PostgreSQL's atomic UPDATE
          // predicate when two redemption transactions race.
          invite.usedAt = data.usedAt;
          return { count: 1 };
        }
      )
    },
    workspaceMember: {
      findUnique: vi.fn(
        async ({
          where
        }: {
          where: {
            workspaceId_userId: { workspaceId: string; userId: string };
          };
        }) =>
          memberships.find(
            (membership) =>
              membership.workspaceId ===
                where.workspaceId_userId.workspaceId &&
              membership.userId === where.workspaceId_userId.userId
          ) ?? null
      ),
      create: vi.fn(
        async ({
          data
        }: {
          data: {
            workspaceId: string;
            userId: string;
            role: "COACH" | "ASSISTANT";
          };
        }) => {
          const membership = {
            id: `member-${memberships.length + 1}`,
            ...data
          };
          memberships.push(membership);
          return membership;
        }
      )
    }
  } as unknown as StaffInviteTransaction;

  const database = {
    $transaction: vi.fn(
      async <T>(
        callback: (tx: StaffInviteTransaction) => Promise<T>
      ): Promise<T> => callback(transaction)
    )
  } as unknown as StaffInviteDatabase;

  return { database, memberships, transaction };
}

function activeInvite(role: string): MutableInvite {
  return {
    id: "invite-1",
    workspaceId: "team-a",
    code: "STAFFCODE",
    role,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null
  };
}

describe("staff invite redemption", () => {
  it("never accepts a PLAYER self-registration code as staff", async () => {
    const invite = activeInvite("PLAYER");
    const { database, memberships, transaction } =
      createInviteDatabase(invite);

    await expect(
      redeemStaffInviteWithDatabase(database, "user-a", "staffcode")
    ).rejects.toThrow("Ungültiger Einladungscode.");
    expect(transaction.teamInvite.updateMany).not.toHaveBeenCalled();
    expect(memberships).toHaveLength(0);
    expect(invite.usedAt).toBeNull();
  });

  it("allows exactly one winner when the same invite is redeemed concurrently", async () => {
    const invite = activeInvite("coach");
    const { database, memberships } = createInviteDatabase(invite);

    const results = await Promise.allSettled([
      redeemStaffInviteWithDatabase(database, "user-a", "staffcode"),
      redeemStaffInviteWithDatabase(database, "user-b", "staffcode")
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1
    );
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(
      1
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("COACH");
    expect(invite.usedAt).toBeInstanceOf(Date);
  });

  it("maps an assistant invite only to the ASSISTANT membership role", async () => {
    const invite = activeInvite("assistant");
    const { database, memberships } = createInviteDatabase(invite);

    await expect(
      redeemStaffInviteWithDatabase(database, "user-a", "staffcode")
    ).resolves.toBe("team-a");
    expect(memberships).toEqual([
      {
        id: "member-1",
        workspaceId: "team-a",
        userId: "user-a",
        role: "ASSISTANT"
      }
    ]);
  });

  it("does not consume the invite when the user is already a member", async () => {
    const invite = activeInvite("coach");
    const { database, memberships, transaction } =
      createInviteDatabase(invite);
    memberships.push({
      id: "existing-member",
      workspaceId: "team-a",
      userId: "user-a",
      role: "ASSISTANT"
    });

    await expect(
      redeemStaffInviteWithDatabase(database, "user-a", "staffcode")
    ).resolves.toBe("team-a");
    expect(invite.usedAt).toBeNull();
    expect(transaction.teamInvite.updateMany).not.toHaveBeenCalled();
    expect(transaction.workspaceMember.create).not.toHaveBeenCalled();
    expect(memberships).toHaveLength(1);
  });
});
