import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

export const trainingRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.training.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { date: "desc" },
      });
    }),
});
