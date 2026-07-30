import { describe, expect, it } from "vitest";
import { opaqueKey } from "./opaque-key";

describe("opaqueKey", () => {
  it("is deterministic without exposing the source identifier", async () => {
    const first = await opaqueKey("login_fail", "coach@example.com");
    const second = await opaqueKey("login_fail", "coach@example.com");

    expect(first).toBe(second);
    expect(first).toMatch(/^login_fail:[0-9a-f]{64}$/);
    expect(first).not.toContain("coach@example.com");
  });

  it("separates namespaces", async () => {
    await expect(opaqueKey("rate_limit", "same-value")).resolves.not.toBe(
      await opaqueKey("login_fail", "same-value")
    );
  });
});
