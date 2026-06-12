import { createTRPCRouter, workspaceProcedure } from "../init";

export const trainingRouter = createTRPCRouter({
  list: workspaceProcedure.query(async ({ ctx, input }) => {
    return ctx.db.training.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { date: "desc" },
    });
  }),
});
