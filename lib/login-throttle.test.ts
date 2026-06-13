import { describe, expect, it } from "vitest";
import {
  clearLoginAttempts,
  getLoginThrottle,
  recordFailedLogin,
} from "./login-throttle";

// Redis is unavailable in unit tests, so these exercise the in-memory fallback.

describe("login-throttle (in-memory fallback)", () => {
  it("is unlocked initially", async () => {
    const state = await getLoginThrottle("fresh@example.com");
    expect(state.locked).toBe(false);
  });

  it("locks after 5 failed attempts and reports a retry window", async () => {
    const id = "victim@example.com";
    for (let i = 0; i < 5; i++) await recordFailedLogin(id);
    const state = await getLoginThrottle(id);
    expect(state.locked).toBe(true);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("clears the counter on success", async () => {
    const id = "recover@example.com";
    for (let i = 0; i < 5; i++) await recordFailedLogin(id);
    expect((await getLoginThrottle(id)).locked).toBe(true);
    await clearLoginAttempts(id);
    expect((await getLoginThrottle(id)).locked).toBe(false);
  });

  it("is case-insensitive on the identifier", async () => {
    const id = "Case@Example.com";
    for (let i = 0; i < 5; i++) await recordFailedLogin(id);
    expect((await getLoginThrottle("case@example.com")).locked).toBe(true);
  });
});
