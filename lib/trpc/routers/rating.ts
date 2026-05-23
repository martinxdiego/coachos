import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

export const ratingRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ playerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.rating.findMany({
        where: { playerId: input.playerId },
        orderBy: { date: "desc" },
      });
    }),
});
