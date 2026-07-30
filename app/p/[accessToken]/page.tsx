import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer"
};

interface LegacyPlayerLinkProps {
  params: Promise<{ accessToken: string }>;
}

export default async function LegacyPlayerLink({
  params
}: LegacyPlayerLinkProps) {
  const { accessToken } = await params;
  redirect(`/api/player/session/${encodeURIComponent(accessToken)}`);
}
