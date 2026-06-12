import { createTRPCRouter, playerProcedure } from "../init";

export const healthRouter = createTRPCRouter({
  list: playerProcedure.query(async ({ ctx, input }) => {
    return ctx.db.healthCheck.findMany({
      where: { playerId: input.playerId },
      orderBy: { date: "desc" },
    });
  }),
});
