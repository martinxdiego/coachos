import { CalendarCheck, Check, HelpCircle, UsersRound, X } from "lucide-react";
import { requireActiveTeam } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, todayIsoDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

const statusUi = {
  YES: { label: "Dabei", variant: "success" as const, icon: Check },
  MAYBE: { label: "Vielleicht", variant: "secondary" as const, icon: HelpCircle },
  NO: { label: "Abwesend", variant: "destructive" as const, icon: X }
};

export default async function AvailabilityPage() {
  const { team } = await requireActiveTeam();
  const today = new Date(`${todayIsoDate()}T00:00:00.000Z`);
  const [trainings, matches, players] = await Promise.all([
    db.training.findMany({
      where: { workspaceId: team.id, date: { gte: today } },
      select: { id: true, date: true, startTime: true, focus: true },
      orderBy: { date: "asc" },
      take: 10
    }),
    db.match.findMany({
      where: { workspaceId: team.id, date: { gte: today } },
      select: { id: true, date: true, kickoffTime: true, opponent: true },
      orderBy: { date: "asc" },
      take: 10
    }),
    db.player.findMany({
      where: { workspaceId: team.id },
      select: { id: true, name: true, jerseyNumber: true },
      orderBy: [{ jerseyNumber: "asc" }, { name: "asc" }]
    })
  ]);
  const events = [
    ...trainings.map((training) => ({
      id: training.id,
      type: "TRAINING" as const,
      title: training.focus,
      label: "Training",
      date: training.date,
      time: training.startTime
    })),
    ...matches.map((match) => ({
      id: match.id,
      type: "MATCH" as const,
      title: `vs. ${match.opponent}`,
      label: "Spiel",
      date: match.date,
      time: match.kickoffTime
    }))
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 12);
  const responses =
    events.length > 0
      ? await db.availabilityResponse.findMany({
          where: {
            workspaceId: team.id,
            OR: events.map((event) => ({
              eventType: event.type,
              eventId: event.id
            }))
          },
          select: {
            eventType: true,
            eventId: true,
            playerId: true,
            status: true,
            respondedAt: true
          }
        })
      : [];
  const responseMap = new Map(
    responses.map((response) => [
      `${response.eventType}:${response.eventId}:${response.playerId}`,
      response
    ])
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
          Live-Kader
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Zu- und Absagen
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Antworten von Spielern und Eltern für kommende Trainings und Spiele.
        </p>
      </header>

      {events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event) => {
            const eventResponses = players.map((player) => ({
              player,
              response: responseMap.get(
                `${event.type}:${event.id}:${player.id}`
              )
            }));
            const counts = {
              YES: eventResponses.filter((item) => item.response?.status === "YES").length,
              MAYBE: eventResponses.filter((item) => item.response?.status === "MAYBE").length,
              NO: eventResponses.filter((item) => item.response?.status === "NO").length
            };
            const open = players.length - counts.YES - counts.MAYBE - counts.NO;
            return (
              <Card key={`${event.type}:${event.id}`}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Badge variant="secondary">{event.label}</Badge>
                      <CardTitle className="mt-2">{event.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(event.date.toISOString().slice(0, 10))}
                        {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="success">{counts.YES} dabei</Badge>
                      <Badge variant="secondary">{counts.MAYBE} vielleicht</Badge>
                      <Badge variant="destructive">{counts.NO} abwesend</Badge>
                      <Badge variant="outline">{open} offen</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {eventResponses.map(({ player, response }) => {
                      const ui = response ? statusUi[response.status] : null;
                      const Icon = ui?.icon ?? UsersRound;
                      return (
                        <div
                          className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/30 px-3 py-2"
                          key={player.id}
                        >
                          <span className="truncate text-sm font-medium">
                            {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}
                            {player.name}
                          </span>
                          <Badge variant={ui?.variant ?? "outline"}>
                            <Icon aria-hidden="true" className="mr-1 h-3 w-3" />
                            {ui?.label ?? "Offen"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          body="Lege zuerst ein kommendes Training oder Spiel an."
          icon={CalendarCheck}
          title="Keine kommenden Termine"
        />
      )}
    </div>
  );
}
