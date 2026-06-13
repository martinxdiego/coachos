import { z } from "zod";
import {
  assertPlayerAccess,
  createTRPCRouter,
  protectedProcedure,
  workspaceProcedure,
} from "../init";

export const playerRouter = createTRPCRouter({
  list: workspaceProcedure.query(async ({ ctx, input }) => {
    return ctx.db.player.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { name: "asc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertPlayerAccess(ctx.db, ctx.user.id!, input.id);
      return ctx.db.player.findUnique({
        where: { id: input.id },
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        number: z.number().optional(),
        jerseyNumber: z.number().optional(),
        position: z.string().optional(),
        strongFoot: z.string().optional(),
        birthYear: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.player.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          firstName: input.firstName,
          lastName: input.lastName,
          number: input.number,
          jerseyNumber: input.jerseyNumber,
          position: input.position,
          strongFoot: input.strongFoot,
          birthYear: input.birthYear,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        number: z.number().optional(),
        jerseyNumber: z.number().optional(),
        position: z.string().optional(),
        strongFoot: z.string().optional(),
        birthYear: z.number().optional(),
        status: z
          .enum([
            "FIT",
            "REHAB",
            "INJURED",
            "available",
            "injured",
            "limited",
            "absent",
          ])
          .optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertPlayerAccess(ctx.db, ctx.user.id!, id);
      return ctx.db.player.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlayerAccess(ctx.db, ctx.user.id!, input.id);
      return ctx.db.player.delete({
        where: { id: input.id },
      });
    }),
});
