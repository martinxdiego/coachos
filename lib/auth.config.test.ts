import { describe, expect, it } from "vitest";
import { authConfig } from "./auth.config";

function authorized(pathname: string, loggedIn = false) {
  const callback = authConfig.callbacks.authorized;
  if (!callback) throw new Error("authorized callback is missing");

  return callback({
    auth: loggedIn ? ({ user: { id: "user-1" } } as never) : null,
    request: {
      nextUrl: new URL(`https://coachos.test${pathname}`)
    }
  } as never);
}

describe("auth route policy", () => {
  it("blocks protected pages and APIs without a session", () => {
    expect(authorized("/")).toBe(false);
    expect(authorized("/players")).toBe(false);
    expect(authorized("/api/pdf/training/training-1")).toBe(false);
    expect(authorized("/api/authentication")).toBe(false);
  });

  it("allows only explicitly public or independently authenticated routes", () => {
    expect(authorized("/login")).toBe(true);
    expect(authorized("/login?reauth=1", true)).toBe(true);
    expect(authorized("/offline")).toBe(true);
    expect(authorized("/offline.html")).toBe(true);
    expect(authorized("/manifest.json")).toBe(true);
    expect(authorized("/sw.js")).toBe(true);
    expect(authorized("/join/invite-token")).toBe(true);
    expect(authorized("/p/player-token")).toBe(true);
    expect(authorized("/verify-email/verification-token")).toBe(true);
    expect(authorized("/legal/privacy")).toBe(true);
    expect(authorized("/api/auth/callback/credentials")).toBe(true);
    expect(authorized("/api/stripe/webhook")).toBe(true);
    expect(authorized("/api/push/subscribe")).toBe(true);
    expect(authorized("/api/push/daily")).toBe(true);
    expect(authorized("/api/storage/retention")).toBe(true);
    expect(authorized("/api/health")).toBe(true);
  });

  it("allows protected routes with a session", () => {
    expect(authorized("/players", true)).toBe(true);
  });
});
