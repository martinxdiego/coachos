"use client";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

// QR-Code via api.qrserver.com — free, stable, no signup.
export function qrCodeUrl(value: string, size = 220) {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data: value,
    margin: "2",
    ecc: "M"
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

export function QrCode({ value, size = 220, className, alt }: QrCodeProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      alt={alt ?? "QR-Code"}
      className={className}
      height={size}
      src={qrCodeUrl(value, size)}
      width={size}
    />
  );
}
