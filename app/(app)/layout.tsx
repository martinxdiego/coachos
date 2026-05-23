import { AppShell } from "@/components/app-shell";
import { getOptionalActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { activeTeam, teamOptions } = await getOptionalActiveTeam();
  const quickPlayers = activeTeam
    ? await db.player.findMany({
        where: {
          workspaceId: activeTeam.team.id,
        },
        select: {
          id: true,
          name: true,
          position: true,
        },
        orderBy: {
          name: "asc",
        },
      })
    : [];

  return (
    <AppShell
      activeTeam={activeTeam?.team}
      quickPlayers={quickPlayers}
      teamOptions={teamOptions}
    >
      {children}
    </AppShell>
  );
}

