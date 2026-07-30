"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, ImagePlus, Loader2, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { removePlayerPhoto, uploadPlayerPhoto } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { Button } from "@/components/ui/button";
import { prepareBrowserImageUpload } from "@/lib/browser-image-upload";

interface PlayerPhotoUploadProps {
  playerId: string;
  playerName: string;
  photoUrl: string | null;
}

export function PlayerPhotoUpload({
  playerId,
  playerName,
  photoUrl
}: PlayerPhotoUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionRequestRef = useRef(0);
  const isBusy = isPreparing || isPending;

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function reset() {
    selectionRequestRef.current += 1;
    setIsPreparing(false);
    setPreparationError(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    setIsOpen(false);
    reset();
  }

  async function pick(file: File) {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setPreparationError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsPreparing(true);

    try {
      if (file.type.toLowerCase() === "image/gif" || /\.gif$/i.test(file.name)) {
        throw new Error("Spielerfotos müssen JPG, PNG, WEBP oder HEIC sein.");
      }
      const preparedFile = await prepareBrowserImageUpload(file);
      if (selectionRequestRef.current !== requestId) return;

      setSelectedFile(preparedFile);
      setPreviewUrl(URL.createObjectURL(preparedFile));
    } catch (error) {
      if (selectionRequestRef.current !== requestId) return;
      const message =
        error instanceof Error
          ? error.message
          : "Das Bild konnte nicht vorbereitet werden.";
      setPreparationError(message);
      toast.error(message);
    } finally {
      if (selectionRequestRef.current === requestId) {
        setIsPreparing(false);
      }
    }
  }

  function handleUpload() {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.set("player_id", playerId);
    formData.set("photo", selectedFile);
    startTransition(async () => {
      try {
        await uploadPlayerPhoto(formData);
        toast.success("Foto aktualisiert");
        close();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Upload fehlgeschlagen."
        );
      }
    });
  }

  function handleRemove() {
    const formData = new FormData();
    formData.set("player_id", playerId);
    startTransition(async () => {
      try {
        await removePlayerPhoto(formData);
        toast.success("Foto entfernt");
        close();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Entfernen fehlgeschlagen."
        );
      }
    });
  }

  return (
    <>
      <button
        aria-label="Foto ändern"
        className="absolute bottom-3 right-3 inline-flex h-11 items-center gap-2 rounded-full bg-card/90 px-3 text-[12px] font-medium tracking-tight text-foreground shadow-elevated backdrop-blur-md transition-transform duration-200 ease-spring hover:bg-card active:scale-95 sm:h-9"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Camera aria-hidden="true" className="h-3.5 w-3.5" />
        {photoUrl ? "Foto ändern" : "Foto hochladen"}
      </button>

      <SideDrawer
        description={`Lade ein neues Bild für ${playerName} hoch oder entferne das aktuelle. JPG, PNG, WEBP oder HEIC bis 20 MB werden vor dem Upload automatisch optimiert.`}
        eyebrow="Spielerfoto"
        isOpen={isOpen}
        onClose={close}
        title="Foto verwalten"
      >
        <div aria-busy={isBusy} className="space-y-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/70 bg-secondary/40">
            {previewUrl || photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={playerName}
                className="h-full w-full object-cover"
                src={previewUrl ?? photoUrl ?? ""}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <UserRound aria-hidden="true" className="h-16 w-16" />
              </div>
            )}
            {previewUrl ? (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-foreground/90 px-2.5 py-0.5 text-[11px] font-medium text-background">
                Vorschau
              </span>
            ) : null}
          </div>

          <input
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            id="player-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void pick(file);
            }}
            ref={fileInputRef}
            type="file"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-11 flex-1"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="outline"
            >
              {isPreparing ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus aria-hidden="true" className="h-4 w-4" />
              )}
              {isPreparing
                ? "Bild wird optimiert…"
                : selectedFile
                  ? "Anderes Bild"
                  : "Bild wählen"}
            </Button>
            <Button
              className="h-11 flex-1"
              disabled={!selectedFile || isBusy}
              onClick={handleUpload}
              type="button"
            >
              {isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Camera aria-hidden="true" className="h-4 w-4" />
              )}
              {isPending ? "Wird hochgeladen…" : "Foto speichern"}
            </Button>
          </div>

          {isPreparing ? (
            <div
              aria-live="polite"
              className="flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5 text-[12px] text-muted-foreground"
              role="status"
            >
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin"
              />
              Das Bild wird für einen schnellen mobilen Upload vorbereitet.
            </div>
          ) : null}

          {preparationError ? (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive"
              role="alert"
            >
              {preparationError}
            </p>
          ) : null}

          {selectedFile ? (
            <div className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5 text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {selectedFile.name}
              </span>{" "}
              · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
          ) : null}

          {photoUrl ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3">
              <p className="text-[13px] text-muted-foreground">
                Aktuelles Foto entfernen
              </p>
              <Button
                className="h-11"
                disabled={isBusy}
                onClick={handleRemove}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Entfernen
              </Button>
            </div>
          ) : null}
        </div>
      </SideDrawer>
    </>
  );
}
