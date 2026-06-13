import { afterEach, describe, expect, it, vi } from "vitest";
import { captureException, logger, registerErrorSink } from "./logger";

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
