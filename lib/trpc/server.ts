import { createCallerFactory, createTRPCContext } from "./init";
import { appRouter } from "./routers/_app";

const createCaller = createCallerFactory(appRouter);

export const api = createCaller(createTRPCContext);
