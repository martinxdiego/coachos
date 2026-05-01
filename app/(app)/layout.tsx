import { AppShell } from "@/components/app-shell";
import { getOptionalActiveTeam } from "@/lib/auth";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { activeTeam, supabase, teamOptions } = await getOptionalActiveTeam();
  const quickPlayers = activeTeam
    ? await supabase
        .from("players")
        .select("id,name,position")
        .eq("team_id", activeTeam.team.id)
        .order("name", { ascending: true })
        .then((result) => {
          if (result.error) {
            throw new Error(result.error.message);
          }

          return result.data ?? [];
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
