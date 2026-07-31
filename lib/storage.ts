import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const PLAYER_PHOTO_BUCKET = "player-photos";
export const PLAYER_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PLAYER_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

export const TRAINING_IMAGE_BUCKET = "training-images";
export const TRAINING_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const TRAINING_IMAGE_MAX_PER_PHASE = 8;
export const TRAINING_IMAGE_MAX_PER_WORKSPACE = 500;
export const TRAINING_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif"
]);

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function normalizeStoragePath(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.trim());
  } catch {
    return null;
  }

  const path = decoded.replace(/^\/+|\/+$/g, "");
  if (
    !path ||
    path.includes("\\") ||
    path.includes("%") ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    path.includes("?") ||
    path.includes("#")
  ) {
    return null;
  }

  const segments = path.split("/");
  if (
    segments.some(
      (segment) => !segment || segment === "." || segment === ".."
    )
  ) {
    return null;
  }

  return segments.join("/");
}

function normalizeExpectedPrefix(expectedPrefix: string): string | null {
  const prefix = normalizeStoragePath(expectedPrefix);
  return prefix ? `${prefix}/` : null;
}

export function pathFromStorageReference(
  reference: string,
  bucket: string,
  expectedPrefix: string
): string | null {
  const value = reference.trim();
  if (!value) return null;

  const prefix = normalizeExpectedPrefix(expectedPrefix);
  if (!prefix) return null;

  let path: string | null = null;
  if (!/^https?:\/\//i.test(value)) {
    path = normalizeStoragePath(value);
  } else {
    try {
      const pathname = new URL(value).pathname;
      const markers = [
        `/storage/v1/object/public/${bucket}/`,
        `/storage/v1/object/sign/${bucket}/`,
        `/storage/v1/object/${bucket}/`
      ];

      for (const marker of markers) {
        if (pathname.startsWith(marker)) {
          path = normalizeStoragePath(pathname.slice(marker.length));
          break;
        }
      }
    } catch {
      return null;
    }
  }

  return path?.startsWith(prefix) ? path : null;
}

export const pathFromPublicUrl = pathFromStorageReference;

export function storagePathsForReferences(
  bucket: string,
  references: readonly (string | null | undefined)[],
  expectedPrefix: string
): string[] {
  return Array.from(
    new Set(
      references.flatMap((reference) => {
        if (!reference) return [];
        const path = pathFromStorageReference(
          reference,
          bucket,
          expectedPrefix
        );
        return path ? [path] : [];
      })
    )
  );
}

export async function createSignedStorageUrl(
  bucket: string,
  reference: string | null | undefined,
  expectedPrefix: string
): Promise<string | null> {
  if (!reference) return null;

  const path = pathFromStorageReference(reference, bucket, expectedPrefix);
  if (!path) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    logger.error("Could not create signed storage URL", { bucket });
    return null;
  }

  return data.signedUrl;
}

export async function createSignedStorageUrls(
  bucket: string,
  references: readonly (string | null | undefined)[],
  expectedPrefix: string
): Promise<(string | null)[]> {
  return Promise.all(
    references.map((reference) =>
      createSignedStorageUrl(bucket, reference, expectedPrefix)
    )
  );
}

export async function removeStorageReferences(
  bucket: string,
  references: readonly (string | null | undefined)[],
  expectedPrefix: string
): Promise<boolean> {
  const paths = storagePathsForReferences(
    bucket,
    references,
    expectedPrefix
  );
  if (paths.length === 0) return true;

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (!error) return true;

    logger.error("Could not remove private storage objects", {
      bucket,
      objectCount: paths.length,
      errorType: error.name ?? "StorageError"
    });
  } catch (error) {
    logger.error("Could not remove private storage objects", {
      bucket,
      objectCount: paths.length,
      errorType:
        error instanceof Error ? error.constructor.name : typeof error
    });
  }

  return false;
}
