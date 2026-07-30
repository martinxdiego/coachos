import { describe, expect, it } from "vitest";
import {
  detectImageType,
  IMAGE_MAX_OUTPUT_BYTES,
  IMAGE_MAX_OUTPUT_DIMENSION,
  prepareUploadedImage,
  validateUploadedImage
} from "./image-upload";

describe("detectImageType", () => {
  it("detects supported image signatures", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, ...Array(9).fill(0)])))
      .toEqual({ extension: "jpg", mimeType: "image/jpeg" });
    expect(
      detectImageType(
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0
        ])
      )
    ).toEqual({ extension: "png", mimeType: "image/png" });
  });

  it("rejects content without a supported image signature", () => {
    expect(
      detectImageType(
        new TextEncoder().encode("<script>alert('not an image')</script>")
      )
    ).toBeNull();
  });
});

describe("validateUploadedImage", () => {
  it("rejects a misleading declared MIME type", async () => {
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0
    ]);
    const file = new File([pngBytes], "photo.jpg", { type: "image/jpeg" });

    await expect(
      validateUploadedImage(file, new Set(["image/jpeg", "image/png"]))
    ).rejects.toThrow("stimmen nicht überein");
  });
});

describe("prepareUploadedImage", () => {
  it("auto-rotates, re-encodes to WebP, and strips image metadata", async () => {
    const { default: sharp } = await import("sharp");
    const source = await sharp({
      create: {
        width: 60,
        height: 30,
        channels: 3,
        background: "#2f855a"
      }
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const sourceMetadata = await sharp(source).metadata();
    expect(sourceMetadata.orientation).toBe(6);

    const prepared = await prepareUploadedImage(
      new File([source], "portrait.jpg", { type: "image/jpeg" }),
      new Set(["image/jpeg"])
    );
    const outputMetadata = await sharp(prepared.data).metadata();

    expect(prepared.mimeType).toBe("image/webp");
    expect(prepared.extension).toBe("webp");
    expect(outputMetadata.format).toBe("webp");
    expect(outputMetadata.width).toBe(30);
    expect(outputMetadata.height).toBe(60);
    expect(outputMetadata.orientation).toBeUndefined();
    expect(outputMetadata.exif).toBeUndefined();
    expect(prepared.data.length).toBeLessThanOrEqual(IMAGE_MAX_OUTPUT_BYTES);
  });

  it("limits output dimensions without enlarging the image", async () => {
    const { default: sharp } = await import("sharp");
    const source = await sharp({
      create: {
        width: 3_000,
        height: 120,
        channels: 3,
        background: "#1a365d"
      }
    })
      .png()
      .toBuffer();

    const prepared = await prepareUploadedImage(
      new File([source], "wide.png", { type: "image/png" }),
      new Set(["image/png"])
    );

    expect(prepared.width).toBe(IMAGE_MAX_OUTPUT_DIMENSION);
    expect(prepared.height).toBeLessThan(120);
    expect(prepared.data.length).toBeLessThanOrEqual(IMAGE_MAX_OUTPUT_BYTES);
  });

  it("returns a clear error when the server cannot decode HEIC", async () => {
    const heicHeader = new Uint8Array(16);
    heicHeader.set(new TextEncoder().encode("ftyp"), 4);
    heicHeader.set(new TextEncoder().encode("heic"), 8);

    await expect(
      prepareUploadedImage(
        new File([heicHeader], "photo.heic", { type: "image/heic" }),
        new Set(["image/heic"])
      )
    ).rejects.toThrow("HEIC/HEIF konnte auf diesem Server nicht verarbeitet");
  });
});
