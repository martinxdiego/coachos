import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*e2e.spec.ts",
  timeout: 180000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  maxFailures: process.env.CI ? 1 : undefined,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "android-chromium",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone SE (3rd gen)"] },
    },
    {
      name: "tablet-webkit",
      use: { ...devices["iPad Mini"] },
    },
  ],
});
