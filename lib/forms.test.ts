import { describe, expect, it } from "vitest";
import {
  enumValue,
  normalizeExternalUrl,
  optionalNumber,
  optionalScaleFive,
  optionalString,
  requiredRating,
  requiredString,
  scaleFive,
} from "./forms";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("requiredString", () => {
  it("returns trimmed value", () => {
    expect(requiredString(fd({ name: "  Max " }), "name", "Name")).toBe("Max");
  });
  it("throws on empty/missing", () => {
    expect(() => requiredString(fd({ name: "  " }), "name", "Name")).toThrow(
      "Name is required."
    );
    expect(() => requiredString(fd({}), "name", "Name")).toThrow();
  });
});

describe("optionalString", () => {
  it("returns null when empty", () => {
    expect(optionalString(fd({ x: "  " }), "x")).toBeNull();
    expect(optionalString(fd({}), "x")).toBeNull();
  });
  it("returns value when present", () => {
    expect(optionalString(fd({ x: " hi " }), "x")).toBe("hi");
  });
});

describe("optionalNumber", () => {
  it("parses numbers and rejects junk", () => {
    expect(optionalNumber(fd({ n: "42" }), "n")).toBe(42);
    expect(optionalNumber(fd({ n: "" }), "n")).toBeNull();
    expect(optionalNumber(fd({ n: "abc" }), "n")).toBeNull();
  });
});

describe("scaleFive", () => {
  it("accepts 1..5", () => {
    expect(scaleFive(fd({ s: "3" }), "s", "Scale")).toBe(3);
  });
  it("rejects out of range / non-integer", () => {
    expect(() => scaleFive(fd({ s: "0" }), "s", "Scale")).toThrow();
    expect(() => scaleFive(fd({ s: "6" }), "s", "Scale")).toThrow();
    expect(() => scaleFive(fd({ s: "2.5" }), "s", "Scale")).toThrow();
  });
});

describe("optionalScaleFive", () => {
  it("null when empty, value when valid, throws when invalid", () => {
    expect(optionalScaleFive(fd({}), "s")).toBeNull();
    expect(optionalScaleFive(fd({ s: "5" }), "s")).toBe(5);
    expect(() => optionalScaleFive(fd({ s: "9" }), "s")).toThrow();
  });
});

describe("requiredRating", () => {
  it("accepts 1..10, rejects otherwise", () => {
    expect(requiredRating(fd({ rating: "7" }))).toBe(7);
    expect(() => requiredRating(fd({ rating: "0" }))).toThrow();
    expect(() => requiredRating(fd({ rating: "11" }))).toThrow();
  });
});

describe("normalizeExternalUrl", () => {
  it("prefixes bare domains with https://", () => {
    expect(normalizeExternalUrl("example.com")).toBe("https://example.com");
  });
  it("leaves explicit schemes and paths untouched", () => {
    expect(normalizeExternalUrl("https://a.com")).toBe("https://a.com");
    expect(normalizeExternalUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(normalizeExternalUrl("/relative")).toBe("/relative");
  });
});

describe("enumValue", () => {
  it("returns value when allowed, null otherwise", () => {
    expect(enumValue(fd({ r: "coach" }), "r", ["coach", "assistant"])).toBe(
      "coach"
    );
    expect(enumValue(fd({ r: "boss" }), "r", ["coach", "assistant"])).toBeNull();
  });
});
