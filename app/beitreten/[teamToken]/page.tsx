import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PlayerSelfRegisterForm } from "@/components/player-self-register-form";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface JoinPageProps {
  params: Promise<{
    teamToken: string;
  }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JoinPage({ params }: JoinPageProps) {
  const { teamToken } = await params;
  if (!UUID_RE.test(teamToken)) {
    notFound();
  }

  const workspace = await db.workspace.findUnique({
    where: { id: teamToken },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      season: true
    }
  });

  if (!workspace) {
    notFound();
  }

  const team = {
    id: workspace.id,
    name: workspace.name,
    age_group: workspace.ageGroup,
    season: workspace.season
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-8 text-white sm:py-14">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="text-center">
          <span
            aria-hidden="true"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-300/30"
          >
            <ShieldCheck className="h-6 w-6 text-emerald-300" />
          </span>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Team-Beitritt
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {team.name}
          </h1>
          <p className="mt-1.5 text-[14px] text-slate-300">
            {team.age_group ? `${team.age_group} · ` : ""}
            {team.season ?? "Aktuelle Saison"}
          </p>
          <p className="mt-3 text-[13px] leading-6 text-slate-400">
            Trag dich kurz ein. Du bekommst danach deinen persönlichen Link
            zum Bookmarken — ohne Login.
          </p>
        </header>

        <Card className="border-white/10 bg-white/95 text-slate-900 shadow-elevated">
          <CardContent className="p-5 sm:p-6">
            <PlayerSelfRegisterForm teamToken={teamToken} />
          </CardContent>
        </Card>

        <p className="text-center text-[12px] text-slate-400">
          Mit der Anmeldung stimmst du zu, dass dein Trainer deine Daten zur
          Trainings- und Spielplanung verwendet.
        </p>
      </div>
    </div>
  );
}
