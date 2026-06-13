import { describe, expect, it } from "vitest";
import { generateInviteCode } from "./invites";

describe("generateInviteCode", () => {
  it("produces a URL-safe base64url string", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeGreaterThanOrEqual(12);
  });

  it("is effectively unique across calls", () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateInviteCode()));
    expect(codes.size).toBe(1000);
  });
});
