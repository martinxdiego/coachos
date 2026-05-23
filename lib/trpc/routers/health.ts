import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

export const healthRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ playerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.healthCheck.findMany({
        where: { playerId: input.playerId },
        orderBy: { date: "desc" },
      });
    }),
});
