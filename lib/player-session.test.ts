import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn()
}));
vi.mock("@/lib/db", () => ({
  db: {}
}));

import {
  hashPlayerSessionToken,
  playerDeviceLabel,
  playerSessionCookieOptions
} from "./player-session";

describe("player device sessions", () => {
  it("stores only a deterministic SHA-256 token hash", () => {
    expect(hashPlayerSessionToken("secret-session-token")).toMatch(
      /^[a-f0-9]{64}$/
    );
    expect(hashPlayerSessionToken("secret-session-token")).not.toContain(
      "secret-session-token"
    );
  });

  it("creates understandable device labels without retaining the user agent", () => {
    expect(
      playerDeviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
      )
    ).toBe("iPhone · Safari");
    expect(
      playerDeviceLabel(
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile"
      )
    ).toBe("Android · Chrome");
  });

  it("uses a host-only HttpOnly SameSite cookie", () => {
    expect(playerSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    expect(playerSessionCookieOptions()).not.toHaveProperty("domain");
  });
});
