import { describe, expect, it } from "vitest";
import {
  clearLoginAttempts,
  getLoginThrottle,
  recordFailedLogin,
} from "./login-throttle";

// Redis is unavailable in unit tests, so these exercise the in-memory fallback.

describe("login-throttle (in-memory fallback)", () => {
  it("is unlocked initially", async () => {
    const state = await getLoginThrottle("fresh@example.com", "203.0.113.1");
    expect(state.locked).toBe(false);
  });

  it("locks after 5 failed attempts and reports a retry window", async () => {
    const id = "victim@example.com";
    const ip = "203.0.113.2";
    for (let i = 0; i < 5; i++) await recordFailedLogin(id, ip);
    const state = await getLoginThrottle(id, ip);
    expect(state.locked).toBe(true);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("clears the counter on success", async () => {
    const id = "recover@example.com";
    const ip = "203.0.113.3";
    for (let i = 0; i < 5; i++) await recordFailedLogin(id, ip);
    expect((await getLoginThrottle(id, ip)).locked).toBe(true);
    await clearLoginAttempts(id, ip);
    expect((await getLoginThrottle(id, ip)).locked).toBe(false);
  });

  it("is case-insensitive on the identifier", async () => {
    const id = "Case@Example.com";
    const ip = "203.0.113.4";
    for (let i = 0; i < 5; i++) await recordFailedLogin(id, ip);
    expect(
      (await getLoginThrottle("case@example.com", ip)).locked
    ).toBe(true);
  });

  it("does not let one source lock the account on another network", async () => {
    const id = "known@example.com";
    for (let i = 0; i < 5; i++) {
      await recordFailedLogin(id, "203.0.113.5");
    }

    expect(
      (await getLoginThrottle(id, "203.0.113.5")).locked
    ).toBe(true);
    expect(
      (await getLoginThrottle(id, "198.51.100.5")).locked
    ).toBe(false);
  });
});
