import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const { accessToken } = await params;
  const manifest = {
    name: "CoachOS – Mein Bereich",
    short_name: "CoachOS",
    description: "Dein persönlicher Spieler-Bereich",
    start_url: `/spieler/${accessToken}`,
    display: "standalone",
    orientation: "portrait",
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
    headers: { "Content-Type": "application/manifest+json" },
  });
}
