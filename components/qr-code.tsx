"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

type QrCodeState =
  | {
      status: "loading";
      value: string;
      size: number;
    }
  | {
      status: "ready";
      value: string;
      size: number;
      dataUrl: string;
    }
  | {
      status: "error";
      value: string;
      size: number;
    };

function normalizeSize(size: number) {
  return Number.isFinite(size)
    ? Math.min(2048, Math.max(64, Math.round(size)))
    : 220;
}

export async function createQrCodeDataUrl(value: string, size = 220) {
  if (!value.trim()) {
    throw new Error("QR-Code-Inhalt fehlt.");
  }

  return QRCode.toDataURL(value, {
    color: {
      dark: "#0f172a",
      light: "#ffffff"
    },
    errorCorrectionLevel: "M",
    margin: 2,
    width: normalizeSize(size)
  });
}

export function QrCode({ value, size = 220, className, alt }: QrCodeProps) {
  const normalizedSize = normalizeSize(size);
  const [state, setState] = useState<QrCodeState>({
    status: "loading",
    value,
    size: normalizedSize
  });

  useEffect(() => {
    let isCurrent = true;

    setState({ status: "loading", value, size: normalizedSize });
    void createQrCodeDataUrl(value, normalizedSize).then(
      (dataUrl) => {
        if (isCurrent) {
          setState({
            status: "ready",
            value,
            size: normalizedSize,
            dataUrl
          });
        }
      },
      () => {
        if (isCurrent) {
          setState({ status: "error", value, size: normalizedSize });
        }
      }
    );

    return () => {
      isCurrent = false;
    };
  }, [normalizedSize, value]);

  const isCurrentResult =
    state.value === value && state.size === normalizedSize;
  const accessibleName = alt ?? "QR-Code";
  const placeholderClassName = [
    "grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white text-muted-foreground",
    className
  ]
    .filter(Boolean)
    .join(" ");

  if (!isCurrentResult || state.status === "loading") {
    return (
      <div
        aria-live="polite"
        className={placeholderClassName}
        role="status"
        style={{ height: normalizedSize, width: normalizedSize }}
      >
        <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin" />
        <span className="sr-only">{accessibleName} wird lokal erstellt.</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className={`${placeholderClassName} gap-2 p-4 text-center text-xs`}
        role="alert"
        style={{ height: normalizedSize, width: normalizedSize }}
      >
        <span className="grid justify-items-center gap-2">
          <TriangleAlert aria-hidden="true" className="h-6 w-6" />
          {accessibleName} konnte nicht erstellt werden.
        </span>
      </div>
    );
  }

  return (
    <Image
      alt={accessibleName}
      className={className}
      height={normalizedSize}
      onError={() =>
        setState({ status: "error", value, size: normalizedSize })
      }
      src={state.dataUrl}
      unoptimized
      width={normalizedSize}
    />
  );
}
