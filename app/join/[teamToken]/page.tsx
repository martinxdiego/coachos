import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { PlayerSelfRegisterForm } from "@/components/player-self-register-form";
import { Card, CardContent } from "@/components/ui/card";
import { resolvePlayerSignupInvite } from "@/lib/invites";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true
  }
};

interface JoinPageProps {
  params: Promise<{
    teamToken: string;
  }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { teamToken } = await params;

  const invite = await resolvePlayerSignupInvite(teamToken);
  if (!invite) {
    notFound();
  }

  const t = await getTranslations("join");
  const team = {
    name: invite.workspaceName,
    age_group: invite.ageGroup,
    season: invite.season
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 pb-[calc(2rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pt-[calc(2rem+env(safe-area-inset-top))] text-white sm:pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="text-center">
          <span
            aria-hidden="true"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-300/30"
          >
            <ShieldCheck className="h-6 w-6 text-emerald-300" />
          </span>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {t("badge")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {team.name}
          </h1>
          <p className="mt-1.5 text-[14px] text-slate-300">
            {team.age_group ? `${team.age_group} · ` : ""}
            {team.season ?? t("current_season")}
          </p>
          <p className="mt-3 text-[13px] leading-6 text-slate-400">
            {t("intro")}
          </p>
        </header>

        <Card className="border-white/10 bg-white/95 text-slate-900 shadow-elevated">
          <CardContent className="p-5 sm:p-6">
            <PlayerSelfRegisterForm teamToken={teamToken} />
          </CardContent>
        </Card>

        <p className="text-center text-[12px] text-slate-400">
          {t("consent")}
        </p>
      </div>
    </div>
  );
}
