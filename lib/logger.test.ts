import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureException,
  logger,
  redactSensitiveText,
  registerErrorSink,
} from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
  registerErrorSink(() => {}); // reset to a noop
});

describe("logger", () => {
  it("emits a structured JSON line with level and message", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("hello", { workspaceId: "w1" });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: "info", message: "hello", workspaceId: "w1" });
    expect(typeof line.time).toBe("string");
  });

  it("routes warn/error to the right console method", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.warn("w");
    logger.error("e");
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it("redacts common credentials and personal data from messages", () => {
    const raw =
      "coach@example.com /p/private-token?id=1&accessToken=secret Bearer abc.def";
    const redacted = redactSensitiveText(raw);

    expect(redacted).not.toContain("coach@example.com");
    expect(redacted).not.toContain("private-token");
    expect(redacted).not.toContain("accessToken=secret");
    expect(redacted).not.toContain("Bearer abc.def");
  });
});

describe("captureException", () => {
  it("forwards the error to the registered sink", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn();
    registerErrorSink(sink);
    const err = new Error("boom");
    captureException(err, { playerId: "p1" });
    expect(sink).toHaveBeenCalledWith(err, { playerId: "p1" });
  });

  it("never throws if the sink throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    registerErrorSink(() => {
      throw new Error("sink down");
    });
    expect(() => captureException(new Error("x"))).not.toThrow();
  });
});
