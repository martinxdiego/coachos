import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const createTRPCContext = cache(async () => {
  const session = await auth();
  return {
    db,
    session,
    user: session?.user ?? null,
  };
});

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create();

export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// Protected procedure middleware
export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.session || !opts.ctx.session.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource.",
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      user: opts.ctx.session.user,
    },
  });
});

/**
 * Loads the membership of the current user in a workspace and throws FORBIDDEN
 * if there is none. This is the single enforcement point for multi-tenant
 * isolation — every workspace-scoped read/write must go through it so a logged-in
 * user can never touch another team's data (incl. minors' health records).
 */
async function requireMembership(
  database: typeof db,
  userId: string,
  workspaceId: string
) {
  const membership = await database.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this workspace.",
    });
  }
  return membership;
}

/**
 * Procedure for inputs carrying a `workspaceId`. Verifies the caller is a member
 * of that workspace and exposes the membership (incl. role) on ctx.
 */
export const workspaceProcedure = protectedProcedure
  .input(z.object({ workspaceId: z.string().uuid() }))
  .use(async (opts) => {
    const membership = await requireMembership(
      opts.ctx.db,
      opts.ctx.user.id!,
      opts.input.workspaceId
    );
    return opts.next({ ctx: { ...opts.ctx, membership } });
  });

/**
 * Procedure for inputs carrying a `playerId`. Resolves the player's workspace,
 * verifies membership, and exposes both the player and the membership on ctx.
 */
export const playerProcedure = protectedProcedure
  .input(z.object({ playerId: z.string().uuid() }))
  .use(async (opts) => {
    const player = await opts.ctx.db.player.findUnique({
      where: { id: opts.input.playerId },
      select: { id: true, workspaceId: true },
    });
    if (!player) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });
    }
    const membership = await requireMembership(
      opts.ctx.db,
      opts.ctx.user.id!,
      player.workspaceId
    );
    return opts.next({ ctx: { ...opts.ctx, player, membership } });
  });

/**
 * Asserts the current user may access a player identified by an arbitrary input
 * key (e.g. `id`). Use inside resolvers whose input shape is not `{ playerId }`.
 * Returns the player's workspaceId so callers can scope follow-up writes.
 */
export async function assertPlayerAccess(
  database: typeof db,
  userId: string,
  playerId: string
): Promise<{ workspaceId: string }> {
  const player = await database.player.findUnique({
    where: { id: playerId },
    select: { workspaceId: true },
  });
  if (!player) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Player not found." });
  }
  await requireMembership(database, userId, player.workspaceId);
  return { workspaceId: player.workspaceId };
}
