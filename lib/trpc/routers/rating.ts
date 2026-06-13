import { createTRPCRouter, playerProcedure } from "../init";

export const ratingRouter = createTRPCRouter({
  list: playerProcedure.query(async ({ ctx, input }) => {
    return ctx.db.rating.findMany({
      where: { playerId: input.playerId },
      orderBy: { date: "desc" },
    });
  }),
});
