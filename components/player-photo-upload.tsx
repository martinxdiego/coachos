"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, ImagePlus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { removePlayerPhoto, uploadPlayerPhoto } from "@/app/actions";
import { SideDrawer } from "@/components/side-drawer";
import { Button } from "@/components/ui/button";

interface PlayerPhotoUploadProps {
  playerId: string;
  playerName: string;
  photoUrl: string | null;
}

const MAX_BYTES = 6 * 1024 * 1024;

export function PlayerPhotoUpload({
  playerId,
  playerName,
  photoUrl
}: PlayerPhotoUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function reset() {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    setIsOpen(false);
    reset();
  }

  function pick(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Bild ist zu groß (max 6 MB).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilddateien sind erlaubt.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
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
        className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-full bg-card/90 px-3 text-[12px] font-medium tracking-tight text-foreground shadow-elevated backdrop-blur-md transition-transform duration-200 ease-spring hover:bg-card active:scale-95"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Camera aria-hidden="true" className="h-3.5 w-3.5" />
        {photoUrl ? "Foto ändern" : "Foto hochladen"}
      </button>

      <SideDrawer
        description={`Lade ein neues Bild für ${playerName} hoch oder entferne das aktuelle. JPG, PNG, WEBP oder HEIC, max 6 MB.`}
        eyebrow="Spielerfoto"
        isOpen={isOpen}
        onClose={close}
        title="Foto verwalten"
      >
        <div className="space-y-5">
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
            accept="image/*"
            className="sr-only"
            id="player-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) pick(file);
            }}
            ref={fileInputRef}
            type="file"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="outline"
            >
              <ImagePlus aria-hidden="true" className="h-4 w-4" />
              {selectedFile ? "Anderes Bild" : "Bild wählen"}
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedFile || isPending}
              onClick={handleUpload}
              type="button"
            >
              <Camera aria-hidden="true" className="h-4 w-4" />
              {isPending ? "Wird hochgeladen…" : "Foto speichern"}
            </Button>
          </div>

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
                disabled={isPending}
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
