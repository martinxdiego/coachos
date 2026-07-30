import { NextResponse } from "next/server";

export async function GET() {
  const manifest = {
    name: "CoachOS – Mein Bereich",
    short_name: "CoachOS",
    description: "Dein persönlicher Spieler-Bereich",
    id: "/player",
    start_url: "/player",
    scope: "/",
    lang: "de-CH",
    display: "standalone",
    orientation: "any",
    categories: ["sports", "health"],
    background_color: "#0f172a",
    theme_color: "#10b981",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/manifest+json",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    },
  });
}
