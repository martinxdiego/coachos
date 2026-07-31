import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Components under test use JSX with the automatic runtime (same as Next),
  // so no `import React` is needed in source.
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "server-only": resolve(__dirname, "tests/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/unit/**/*.test.{ts,tsx}"],
    globals: true,
    // Lets modules that import lib/db load without a real database — the pg
    // Pool only connects lazily on first query, which unit tests never trigger.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
