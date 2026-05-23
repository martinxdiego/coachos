import { createTRPCRouter } from "../init";
import { workspaceRouter } from "./workspace";
import { playerRouter } from "./player";
import { trainingRouter } from "./training";
import { matchRouter } from "./match";
import { ratingRouter } from "./rating";
import { healthRouter } from "./health";
import { winnerRouter } from "./winner";

export const appRouter = createTRPCRouter({
  workspace: workspaceRouter,
  player: playerRouter,
  training: trainingRouter,
  match: matchRouter,
  rating: ratingRouter,
  health: healthRouter,
  winner: winnerRouter,
});

export type AppRouter = typeof appRouter;
