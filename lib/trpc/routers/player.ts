import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";

export const playerRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.player.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { name: "asc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.id },
      });
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found",
        });
      }
      return player;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
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
      return ctx.db.player.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.player.delete({
        where: { id: input.id },
      });
    }),
});
