import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl, isProductionDeployment } from "./env";

describe("deployment environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not treat a Vercel preview build as production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(isProductionDeployment()).toBe(false);
  });

  it("keeps real Vercel production protected", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(isProductionDeployment()).toBe(true);
  });

  it("uses the current deployment URL for preview links", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "coachos-preview.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://coachos.example");

    expect(getSiteUrl()).toBe("https://coachos-preview.vercel.app");
  });
});
