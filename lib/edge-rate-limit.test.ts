import { describe, expect, it } from "vitest";
import { edgeRateLimit } from "./edge-rate-limit";

describe("edgeRateLimit", () => {
  it("blocks requests after the configured limit", async () => {
    const identifier = `test-${crypto.randomUUID()}`;

    const first = await edgeRateLimit(identifier, 2, 60);
    const second = await edgeRateLimit(identifier, 2, 60);
    const third = await edgeRateLimit(identifier, 2, 60);

    expect(first).toMatchObject({ success: true, remaining: 1 });
    expect(second).toMatchObject({ success: true, remaining: 0 });
    expect(third).toMatchObject({ success: false, remaining: 0 });
    expect(third.reset).toBe(first.reset);
  });
});
