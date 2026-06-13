import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Default is 1 MB, which is too small for player photos and
      // training-phase image uploads (handy-Fotos sind regelmäßig 2–6 MB).
      // Muss zum clientseitigen Limit (6 MB) plus FormData-Overhead passen.
      bodySizeLimit: "8mb"
    }
  },
  // 308 redirects so links/QR codes shared before the route rename keep working.
  async redirects() {
    return [
      { source: "/spieler/:path*", destination: "/p/:path*", permanent: true },
      { source: "/beitreten/:path*", destination: "/join/:path*", permanent: true },
      { source: "/winnerpunkte", destination: "/points", permanent: true }
    ];
  }
};

export default withNextIntl(nextConfig);
