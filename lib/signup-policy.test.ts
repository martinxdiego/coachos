import { describe, expect, it } from "vitest";
import { isSignupCodeAccepted } from "./signup-policy";

describe("coach signup policy", () => {
  it("allows public registration when no invitation code is configured", () => {
    expect(isSignupCodeAccepted("", undefined)).toBe(true);
  });

  it("accepts the configured invitation code", () => {
    expect(
      isSignupCodeAccepted(
        "coachos-private-pilot",
        "coachos-private-pilot"
      )
    ).toBe(true);
  });

  it("rejects a missing or incorrect configured invitation code", () => {
    expect(isSignupCodeAccepted("", "coachos-private-pilot")).toBe(false);
    expect(
      isSignupCodeAccepted("wrong-code", "coachos-private-pilot")
    ).toBe(false);
  });
});
