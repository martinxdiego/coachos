export interface SafeImageType {
  extension: "jpg" | "png" | "webp" | "gif" | "heic";
  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif"
    | "image/heic";
}

export interface PreparedImage {
  data: Buffer;
  extension: "webp";
  mimeType: "image/webp";
  width: number;
  height: number;
}

export const IMAGE_MAX_SOURCE_PIXELS = 24_000_000;
export const IMAGE_MAX_SOURCE_DIMENSION = 12_000;
export const IMAGE_MAX_OUTPUT_DIMENSION = 2_560;
export const IMAGE_MAX_OUTPUT_BYTES = 3 * 1024 * 1024;

class ImageProcessingError extends Error {}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectImageType(bytes: Uint8Array): SafeImageType | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  if (
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: "png", mimeType: "image/png" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { extension: "webp", mimeType: "image/webp" };
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return { extension: "gif", mimeType: "image/gif" };
  }
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return { extension: "heic", mimeType: "image/heic" };
    }
  }

  return null;
}

export async function validateUploadedImage(
  file: File,
  allowedMimeTypes: ReadonlySet<string>
): Promise<SafeImageType> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = detectImageType(bytes);

  if (!detected || !allowedMimeTypes.has(detected.mimeType)) {
    throw new Error("Die Datei ist kein unterstütztes Bildformat.");
  }

  const declaredType = file.type.toLowerCase();
  const heifFamily =
    declaredType === "image/heic" || declaredType === "image/heif";
  if (
    declaredType &&
    (!allowedMimeTypes.has(declaredType) ||
      (declaredType !== detected.mimeType &&
        !(heifFamily && detected.mimeType === "image/heic")))
  ) {
    throw new Error("Dateityp und Bildinhalt stimmen nicht überein.");
  }

  return detected;
}

/**
 * Fully decodes and re-encodes an upload before it reaches private Storage.
 * Sharp strips EXIF/XMP/IPTC metadata by default; rotate() applies EXIF
 * orientation before that metadata is discarded. A single static WebP output
 * also removes active/polyglot payloads and animated-image complexity.
 */
export async function prepareUploadedImage(
  file: File,
  allowedMimeTypes: ReadonlySet<string>
): Promise<PreparedImage> {
  const detected = await validateUploadedImage(file, allowedMimeTypes);
  const input = Buffer.from(await file.arrayBuffer());

  try {
    const { default: sharp } = await import("sharp");
    const sharpOptions = {
      animated: false,
      failOn: "warning",
      limitInputPixels: IMAGE_MAX_SOURCE_PIXELS,
      sequentialRead: true
    } as const;
    const metadata = await sharp(input, sharpOptions).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!width || !height) {
      throw new ImageProcessingError(
        "Die Bildabmessungen konnten nicht gelesen werden."
      );
    }
    if (
      width > IMAGE_MAX_SOURCE_DIMENSION ||
      height > IMAGE_MAX_SOURCE_DIMENSION ||
      width * height > IMAGE_MAX_SOURCE_PIXELS
    ) {
      throw new ImageProcessingError(
        "Das Bild ist zu gross oder hat zu viele Bildpunkte."
      );
    }

    const attempts = [
      { dimension: IMAGE_MAX_OUTPUT_DIMENSION, quality: 82 },
      { dimension: 2_304, quality: 74 },
      { dimension: 2_048, quality: 66 },
      { dimension: 1_600, quality: 58 }
    ];

    for (const attempt of attempts) {
      const result = await sharp(input, sharpOptions)
        .rotate()
        .resize({
          width: attempt.dimension,
          height: attempt.dimension,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({
          quality: attempt.quality,
          alphaQuality: Math.min(90, attempt.quality + 8),
          effort: 4,
          smartSubsample: true
        })
        .toBuffer({ resolveWithObject: true });

      if (
        result.info.width &&
        result.info.height &&
        result.data.length > 0 &&
        result.data.length <= IMAGE_MAX_OUTPUT_BYTES
      ) {
        return {
          data: result.data,
          extension: "webp",
          mimeType: "image/webp",
          width: result.info.width,
          height: result.info.height
        };
      }
    }

    throw new ImageProcessingError(
      "Das Bild konnte nicht ausreichend komprimiert werden."
    );
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    if (detected.mimeType === "image/heic") {
      throw new Error(
        "HEIC/HEIF konnte auf diesem Server nicht verarbeitet werden. Bitte das Bild als JPG, PNG oder WEBP exportieren."
      );
    }
    throw new Error(
      "Das Bild konnte nicht sicher verarbeitet werden. Bitte eine gültige JPG-, PNG-, WEBP- oder GIF-Datei verwenden."
    );
  }
}
