import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

export const matchRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.match.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { date: "desc" },
      });
    }),
});
