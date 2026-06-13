import { describe, expect, it } from "vitest";
import { safeFilename } from "./filename";

describe("safeFilename", () => {
  it("slugifies, lowercases and joins parts", () => {
    expect(safeFilename(["Training", "2026-06-13", "Pressing"])).toBe(
      "training-2026-06-13-pressing"
    );
  });
  it("strips diacritics and special characters", () => {
    expect(safeFilename(["Spielplän/FCZ*?"])).toBe("spielplanfcz");
  });
  it("drops null/undefined parts", () => {
    expect(safeFilename(["a", null, undefined, "b"])).toBe("a-b");
  });
  it("falls back when everything is stripped", () => {
    expect(safeFilename(["***", "!!!"])).toBe("coachos-export");
  });
  it("caps length at 80 chars", () => {
    expect(safeFilename(["x".repeat(200)]).length).toBeLessThanOrEqual(80);
  });
});
