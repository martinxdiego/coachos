import { createTRPCRouter, workspaceProcedure } from "../init";

export const matchRouter = createTRPCRouter({
  list: workspaceProcedure.query(async ({ ctx, input }) => {
    return ctx.db.match.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { date: "desc" },
    });
  }),
});
