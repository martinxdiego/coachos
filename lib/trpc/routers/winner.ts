import { createTRPCRouter, workspaceProcedure } from "../init";

export const winnerRouter = createTRPCRouter({
  list: workspaceProcedure.query(async ({ ctx, input }) => {
    return ctx.db.winnerPoint.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { date: "desc" },
    });
  }),
});
