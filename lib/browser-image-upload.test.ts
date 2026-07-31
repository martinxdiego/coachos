import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BROWSER_IMAGE_DIMENSION,
  MAX_BROWSER_IMAGE_SOURCE_BYTES,
  prepareBrowserImageUpload,
  TARGET_BROWSER_UPLOAD_BYTES
} from "@/lib/browser-image-upload";

function mockDecodedImage(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ close, height, width }) as unknown as ImageBitmap)
  );
  return close;
}

function mockCanvasOutput() {
  const canvas = {
    getContext: vi.fn(() => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: ""
    })),
    height: 0,
    toBlob: vi.fn(
      (
        callback: BlobCallback,
        mimeType?: string
      ) => callback(new Blob(["prepared"], { type: mimeType }))
    ),
    width: 0
  };
  vi.stubGlobal("document", {
    createElement: vi.fn(() => canvas)
  });
  return canvas;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prepareBrowserImageUpload", () => {
  it("keeps an upload-ready image unchanged", async () => {
    const close = mockDecodedImage(1_200, 800);
    const file = new File(["small"], "team.jpg", { type: "image/jpeg" });

    await expect(prepareBrowserImageUpload(file)).resolves.toBe(file);
    expect(close).toHaveBeenCalledOnce();
  });

  it("resizes a highly compressed image whose dimensions exceed the limit", async () => {
    const close = mockDecodedImage(5_000, 2_500);
    const canvas = mockCanvasOutput();
    const file = new File(["small"], "wide.jpg", { type: "image/jpeg" });

    const prepared = await prepareBrowserImageUpload(file);

    expect(canvas.width).toBe(MAX_BROWSER_IMAGE_DIMENSION);
    expect(canvas.height).toBe(MAX_BROWSER_IMAGE_DIMENSION / 2);
    expect(prepared.type).toBe("image/webp");
    expect(prepared.size).toBeLessThanOrEqual(TARGET_BROWSER_UPLOAD_BYTES);
    expect(close).toHaveBeenCalledOnce();
  });

  it("compresses a source whose byte size exceeds the upload target", async () => {
    mockDecodedImage(1_200, 800);
    mockCanvasOutput();
    const file = {
      name: "large.png",
      size: TARGET_BROWSER_UPLOAD_BYTES + 1,
      type: "image/png"
    } as File;

    const prepared = await prepareBrowserImageUpload(file);

    expect(prepared.size).toBeLessThanOrEqual(TARGET_BROWSER_UPLOAD_BYTES);
    expect(prepared.type).toBe("image/webp");
  });

  it("rejects unsupported formats before attempting to decode them", async () => {
    const file = new File(["<svg/>"], "diagram.svg", {
      type: "image/svg+xml"
    });

    await expect(prepareBrowserImageUpload(file)).rejects.toThrow(
      "Nur JPG, PNG, WEBP, GIF oder HEIC"
    );
  });

  it("rejects source files above 20 MiB", async () => {
    const file = {
      name: "huge.jpg",
      size: MAX_BROWSER_IMAGE_SOURCE_BYTES + 1,
      type: "image/jpeg"
    } as File;

    await expect(prepareBrowserImageUpload(file)).rejects.toThrow("max. 20 MB");
  });
});
