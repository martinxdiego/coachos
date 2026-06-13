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
  }
};

export default withNextIntl(nextConfig);
