"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PdfDownloadButtonProps {
  href: string;
  label?: string;
  filename?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}

// Triggers a browser download via fetch + blob so we can show a loading state
// and a toast on failure. The route still returns Content-Disposition, but we
// honour `filename` if provided to keep things tidy in the user's downloads.
export function PdfDownloadButton({
  href,
  label = "PDF",
  filename,
  size = "sm",
  variant = "outline",
  className
}: PdfDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch(href, { credentials: "include" });
      if (!response.ok) {
        const message = await response
          .json()
          .then((body: { error?: string }) => body.error)
          .catch(() => null);
        throw new Error(
          message ?? `PDF konnte nicht erstellt werden (${response.status}).`
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Prefer the server-suggested filename if none was given by the caller.
      let resolvedName = filename;
      if (!resolvedName) {
        const disposition = response.headers.get("content-disposition") ?? "";
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match?.[1]) resolvedName = match[1];
      }

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = resolvedName ?? "coachos-export.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast.success("PDF erstellt");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "PDF konnte nicht erstellt werden."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      className={cn(className)}
      disabled={isLoading}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
    >
      {isLoading ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown aria-hidden="true" className="h-4 w-4" />
      )}
      {isLoading ? "Wird erstellt…" : label}
    </Button>
  );
}
