"use client";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

// Renders a QR code via the Google Charts API.
// No external dependency; uses an <img> with a stable URL.
export function QrCode({ value, size = 220, className, alt }: QrCodeProps) {
  const url = new URL("https://chart.googleapis.com/chart");
  url.searchParams.set("cht", "qr");
  url.searchParams.set("chs", `${size}x${size}`);
  url.searchParams.set("chld", "M|2");
  url.searchParams.set("chl", value);
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      alt={alt ?? "QR-Code"}
      className={className}
      height={size}
      src={url.toString()}
      width={size}
    />
  );
}
