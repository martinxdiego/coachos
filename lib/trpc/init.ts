import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
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
