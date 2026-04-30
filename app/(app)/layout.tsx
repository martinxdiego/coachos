import { AppShell } from "@/components/app-shell";
import { getOptionalActiveTeam } from "@/lib/auth";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { activeTeam, teamOptions } = await getOptionalActiveTeam();

  return (
    <AppShell activeTeam={activeTeam?.team} teamOptions={teamOptions}>
      {children}
    </AppShell>
  );
}
