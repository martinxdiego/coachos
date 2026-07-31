import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getOptionalActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceLabelOverrides } from "@/lib/workspace-labels";
import { getCoachAttentionCount } from "@/lib/coach-attention";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { activeTeam, teamOptions } = await getOptionalActiveTeam();
  const [quickPlayers, attentionCount] = activeTeam
    ? await Promise.all([
        db.player.findMany({
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
        }),
        getCoachAttentionCount(activeTeam.team.id)
      ])
    : [[], 0];

  const shell = (
    <AppShell
      activeTeam={activeTeam?.team}
      attentionCount={attentionCount}
      quickPlayers={quickPlayers}
      teamOptions={teamOptions}
    >
      {children}
    </AppShell>
  );

  // S6.2: Hat der aktive Workspace eigene Begriffe (Teampunkte/Auszeichnungen/
  // Vereinslinks), überlagern wir die betroffenen i18n-Keys für den gesamten
  // App-Bereich — Navigation und Seitentitel folgen automatisch.
  const overrides = workspaceLabelOverrides(activeTeam?.team);
  if (!overrides) {
    return shell;
  }

  const [messages, locale] = await Promise.all([getMessages(), getLocale()]);
  const base = messages as Record<string, Record<string, string>>;
  const merged = {
    ...messages,
    nav: { ...base.nav, ...overrides.nav },
    pages: { ...base.pages, ...overrides.pages }
  };

  return (
    <NextIntlClientProvider locale={locale} messages={merged}>
      {shell}
    </NextIntlClientProvider>
  );
}

