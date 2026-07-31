"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { removePhaseImage, uploadPhaseImage } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { prepareBrowserImageUpload } from "@/lib/browser-image-upload";
import { cn } from "@/lib/utils";

interface PhaseImageUploaderProps {
  phaseId: string;
  phaseTitle: string;
  images: string[];
  maxImages?: number;
  hideControls?: boolean;
}

export function PhaseImageUploader({
  phaseId,
  phaseTitle,
  images,
  maxImages = 8,
  hideControls = false,
}: PhaseImageUploaderProps) {
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPreviewUrlsRef = useRef(new Set<string>());

  // Revoke any object URLs we created for optimistic previews on unmount.
  useEffect(() => {
    const pendingPreviewUrls = pendingPreviewUrlsRef.current;
    return () => {
      for (const url of pendingPreviewUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  // Close lightbox on Escape.
  useEffect(() => {
    if (!lightboxUrl) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  const totalCount = images.length + pendingPreviews.length;
  const canAdd = totalCount < maxImages;
  const isBusy = isPending || isProcessing;

  function removePendingPreview(previewUrl: string) {
    pendingPreviewUrlsRef.current.delete(previewUrl);
    setPendingPreviews((current) =>
      current.filter((url) => url !== previewUrl)
    );
    URL.revokeObjectURL(previewUrl);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const availableSlots = Math.max(0, maxImages - totalCount);
    const queuedFiles = selectedFiles.slice(0, availableSlots);
    if (selectedFiles.length > availableSlots) {
      toast.error(`Maximal ${maxImages} Bilder pro Phase.`);
    }
    if (queuedFiles.length === 0) return;

    setUploadError(null);
    setIsProcessing(true);
    try {
      for (const [index, file] of queuedFiles.entries()) {
        let previewUrl: string | null = null;
        try {
          setProcessingStatus(
            `Bild ${index + 1}/${queuedFiles.length} wird optimiert…`
          );
          const preparedFile = await prepareBrowserImageUpload(file);
          const preparedPreviewUrl = URL.createObjectURL(preparedFile);
          previewUrl = preparedPreviewUrl;
          pendingPreviewUrlsRef.current.add(preparedPreviewUrl);
          setPendingPreviews((current) => [
            ...current,
            preparedPreviewUrl
          ]);

          setProcessingStatus(
            `Bild ${index + 1}/${queuedFiles.length} wird hochgeladen…`
          );
          const formData = new FormData();
          formData.set("phase_id", phaseId);
          formData.set("image", preparedFile);
          await uploadPhaseImage(formData);
          toast.success("Bild hochgeladen");
        } catch (err) {
          const reason =
            err instanceof Error ? err.message : "Upload fehlgeschlagen.";
          const message = `"${file.name}": ${reason}`;
          setUploadError(message);
          toast.error(message);
        } finally {
          if (previewUrl) removePendingPreview(previewUrl);
        }
      }
    } finally {
      setProcessingStatus(null);
      setIsProcessing(false);
    }
  }

  function handleRemove(url: string) {
    if (removingUrl) return;
    setRemovingUrl(url);

    const formData = new FormData();
    formData.set("phase_id", phaseId);
    formData.set("image_url", url);

    startTransition(async () => {
      try {
        await removePhaseImage(formData);
        toast.success("Bild entfernt");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Entfernen fehlgeschlagen."
        );
      } finally {
        setRemovingUrl(null);
      }
    });
  }

  return (
    <div aria-busy={isBusy} className="space-y-2.5">
      {!hideControls && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Bilder · {images.length}
            {maxImages ? `/${maxImages}` : ""}
          </p>
          <div>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              className="sr-only"
              id={`phase-image-${phaseId}`}
              multiple
              onChange={(event) => void handleFiles(event.target.files)}
              ref={fileInputRef}
              type="file"
            />
            <Button
              className="h-11 sm:h-8"
              disabled={!canAdd || isBusy}
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isBusy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <ImagePlus aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {isProcessing ? "Wird vorbereitet…" : "Bild hinzufügen"}
            </Button>
          </div>
        </div>
      )}

      {!hideControls && totalCount === 0 ? (
        <button
          aria-label={`Bild zu ${phaseTitle} hinzufügen`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-secondary/30 px-3 py-6 text-[12px] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-secondary/60"
          disabled={!canAdd || isBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
          Skizze, Aufstellung oder Übungsfoto anhängen
        </button>
      ) : null}

      {processingStatus ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground"
          role="status"
        >
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 animate-spin"
          />
          {processingStatus}
        </p>
      ) : null}

      {uploadError ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {uploadError}
        </p>
      ) : null}

      {totalCount > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {images.map((url) => {
            const isRemoving = removingUrl === url;
            return (
              <li
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-secondary/40 transition-opacity duration-200",
                  isRemoving && "opacity-50"
                )}
                key={url}
              >
                <button
                  className="block h-full w-full"
                  onClick={() => setLightboxUrl(url)}
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={phaseTitle}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    src={url}
                  />
                </button>
                <button
                  aria-label="Bild entfernen"
                  className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-foreground/90 text-background shadow-soft transition-opacity duration-150 hover:bg-foreground focus-visible:opacity-100 disabled:opacity-50 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
                  disabled={isRemoving || isBusy}
                  onClick={() => handleRemove(url)}
                  type="button"
                >
                  {isRemoving ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                  ) : (
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            );
          })}
          {pendingPreviews.map((url) => (
            <li
              className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-border/70 bg-secondary/40"
              key={url}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Wird hochgeladen…"
                className="h-full w-full object-cover opacity-60"
                src={url}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-foreground/20 backdrop-blur-[1px]">
                <Loader2
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin text-background"
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {lightboxUrl ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/85 p-6 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
        >
          <button
            aria-label="Schließen"
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow-elevated transition-transform duration-200 hover:scale-105"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxUrl(null);
            }}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={phaseTitle}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-elevated animate-scale-in"
            onClick={(event) => event.stopPropagation()}
            src={lightboxUrl}
          />
        </div>
      ) : null}
    </div>
  );
}
