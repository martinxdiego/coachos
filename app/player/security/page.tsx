import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { getPlayerPortalSession } from "@/lib/player-session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  logoutPlayer,
  revokeOtherPlayerSessions,
  revokePlayerSession
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Geräte & Sicherheit · CoachOS",
  robots: { index: false, follow: false }
};

export default async function PlayerSecurityPage() {
  const current = await getPlayerPortalSession();
  if (!current) redirect("/player/access");

  const sessions = await db.playerPortalSession.findMany({
    where: {
      playerId: current.playerId,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      deviceLabel: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true
    }
  });

  return (
    <main className="min-h-dvh bg-secondary/30 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <Button asChild size="sm" variant="ghost">
          <Link href="/player">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Zurück
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 text-emerald-800">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Geräte &amp; Sicherheit</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aktive Spieler- und Elternzugänge für {current.player.name}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((session) => (
              <div
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                key={session.id}
              >
                <div className="flex min-w-0 gap-3">
                  <Smartphone
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{session.deviceLabel}</p>
                      {session.id === current.id ? (
                        <Badge variant="success">Dieses Gerät</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Zuletzt aktiv {formatDateTime(session.lastUsedAt.toISOString())}
                      {" · "}gültig bis {formatDateTime(session.expiresAt.toISOString())}
                    </p>
                  </div>
                </div>
                <form action={revokePlayerSession}>
                  <input name="session_id" type="hidden" value={session.id} />
                  <Button size="sm" type="submit" variant="outline">
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Abmelden
                  </Button>
                </form>
              </div>
            ))}

            {sessions.length > 1 ? (
              <form action={revokeOtherPlayerSessions}>
                <Button type="submit" variant="outline">
                  Andere Geräte abmelden
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <form action={logoutPlayer}>
          <Button className="w-full" type="submit" variant="destructive">
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Auf diesem Gerät abmelden
          </Button>
        </form>
      </div>
    </main>
  );
}
