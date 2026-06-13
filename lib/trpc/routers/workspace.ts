import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";

export const workspaceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.workspaceMember.findMany({
      where: { userId: ctx.user.id },
      include: { workspace: true },
    });
    return memberships.map((m) => m.workspace);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        season: z.string().optional(),
        ageGroup: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.db.workspace.create({
        data: {
          name: input.name,
          season: input.season,
          ageGroup: input.ageGroup,
          members: {
            create: {
              userId: ctx.user.id!,
              role: "OWNER",
            },
          },
        },
      });
      return workspace;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        season: z.string().optional(),
        ageGroup: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: {
          workspaceId: input.id,
          userId: ctx.user.id,
          role: "OWNER",
        },
      });

      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the workspace owner can modify settings.",
        });
      }

      return ctx.db.workspace.update({
        where: { id: input.id },
        data: {
          name: input.name,
          season: input.season,
          ageGroup: input.ageGroup,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: {
          workspaceId: input.id,
          userId: ctx.user.id,
          role: "OWNER",
        },
      });

      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the workspace owner can delete it.",
        });
      }

      return ctx.db.workspace.delete({
        where: { id: input.id },
      });
    }),
});
