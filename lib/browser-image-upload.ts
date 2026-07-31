export const MAX_BROWSER_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const TARGET_BROWSER_UPLOAD_BYTES = Math.floor(2.75 * 1024 * 1024);
export const MAX_BROWSER_IMAGE_DIMENSION = 2_560;

const SUPPORTED_BROWSER_IMAGE_TYPES = new Set([
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const SUPPORTED_BROWSER_IMAGE_EXTENSION =
  /\.(gif|heic|heif|jpe?g|png|webp)$/i;

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in globalThis) {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image"
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close()
      };
    } catch {
      // Safari can decode some camera formats through <img> even when
      // createImageBitmap rejects them.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl)
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(
      "Dieses Bild konnte auf dem Gerät nicht optimiert werden. Bitte als JPG, PNG oder WEBP exportieren."
    );
  }
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/jpeg",
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

function outputName(originalName: string, mimeType: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "bild";
  return `${base}.${mimeType === "image/webp" ? "webp" : "jpg"}`;
}

/**
 * Keeps browser-to-Function multipart bodies below Vercel's 4.5 MB request
 * ceiling. The server still fully decodes and re-encodes the result; this is
 * transport preparation, not a trust boundary.
 */
export async function prepareBrowserImageUpload(file: File): Promise<File> {
  const declaredType = file.type.toLowerCase();
  if (
    (declaredType && !SUPPORTED_BROWSER_IMAGE_TYPES.has(declaredType)) ||
    (!declaredType && !SUPPORTED_BROWSER_IMAGE_EXTENSION.test(file.name))
  ) {
    throw new Error("Nur JPG, PNG, WEBP, GIF oder HEIC sind erlaubt.");
  }
  if (file.size === 0) {
    throw new Error("Das Bild ist leer.");
  }
  if (file.size > MAX_BROWSER_IMAGE_SOURCE_BYTES) {
    throw new Error("Das Ausgangsbild ist zu gross (max. 20 MB).");
  }

  const decoded = await decodeImage(file);
  try {
    if (!decoded.width || !decoded.height) {
      throw new Error("Die Bildabmessungen konnten nicht gelesen werden.");
    }
    if (
      file.size <= TARGET_BROWSER_UPLOAD_BYTES &&
      decoded.width <= MAX_BROWSER_IMAGE_DIMENSION &&
      decoded.height <= MAX_BROWSER_IMAGE_DIMENSION
    ) {
      return file;
    }

    const baseScale = Math.min(
      1,
      MAX_BROWSER_IMAGE_DIMENSION / decoded.width,
      MAX_BROWSER_IMAGE_DIMENSION / decoded.height
    );
    const attempts = [
      { scale: 1, quality: 0.82 },
      { scale: 0.85, quality: 0.72 },
      { scale: 0.7, quality: 0.62 }
    ];

    for (const attempt of attempts) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(
        1,
        Math.round(decoded.width * baseScale * attempt.scale)
      );
      canvas.height = Math.max(
        1,
        Math.round(decoded.height * baseScale * attempt.scale)
      );
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Bildoptimierung ist nicht verfügbar.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      for (const mimeType of ["image/webp", "image/jpeg"] as const) {
        const blob = await canvasBlob(canvas, mimeType, attempt.quality);
        if (!blob || blob.type !== mimeType) continue;
        if (blob.size <= TARGET_BROWSER_UPLOAD_BYTES) {
          return new File([blob], outputName(file.name, blob.type), {
            type: blob.type,
            lastModified: Date.now()
          });
        }
      }
    }
  } finally {
    decoded.cleanup();
  }

  throw new Error(
    "Das Bild bleibt nach der Optimierung zu gross. Bitte einen kleineren Ausschnitt wählen."
  );
}
