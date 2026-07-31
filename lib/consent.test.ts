import { afterEach, describe, expect, it, vi } from "vitest";

describe("privacy consent URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the built-in privacy page when no deployment override exists", async () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_URL", "");

    const { PRIVACY_URL } = await import("./consent");

    expect(PRIVACY_URL).toBe("/legal/privacy");
  });

  it("keeps a configured club privacy URL", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_PRIVACY_URL",
      "https://club.example/privacy"
    );

    const { PRIVACY_URL } = await import("./consent");

    expect(PRIVACY_URL).toBe("https://club.example/privacy");
  });
});
