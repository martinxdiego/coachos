import { describe, expect, it } from "vitest";
import { sanitizeRouteLabel } from "./observability";

describe("sanitizeRouteLabel", () => {
  it("redacts public player and team invitation tokens", () => {
    expect(sanitizeRouteLabel("/p/secret-player-token/checkins")).toBe(
      "/p/[redacted]/checkins"
    );
    expect(sanitizeRouteLabel("/join/secret-team-token")).toBe(
      "/join/[redacted]"
    );
  });

  it("drops query strings and handles missing paths", () => {
    expect(sanitizeRouteLabel("/players?email=coach@example.com")).toBe(
      "/players"
    );
    expect(sanitizeRouteLabel(undefined)).toBe("unknown");
  });
});
