import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

export const winnerRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.winnerPoint.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { date: "desc" },
      });
    }),
});
