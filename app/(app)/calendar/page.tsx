import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { supabase, team } = await requireActiveTeam();
  const [trainingsResult, matchesResult] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id,date,start_time,focus,location")
      .eq("team_id", team.id)
      .order("date", { ascending: true })
      .limit(30),
    supabase
      .from("matches")
      .select("id,date,kickoff_time,opponent,location")
      .eq("team_id", team.id)
      .order("date", { ascending: true })
      .limit(30)
  ]);

  if (trainingsResult.error) {
    throw new Error(trainingsResult.error.message);
  }

  if (matchesResult.error) {
    throw new Error(matchesResult.error.message);
  }

  const events = [
    ...(trainingsResult.data ?? []).map((event) => ({
      id: `training-${event.id}`,
      date: event.date,
      time: event.start_time,
      title: event.focus,
      location: event.location,
      type: "Training",
      href: "/trainings"
    })),
    ...(matchesResult.data ?? []).map((event) => ({
      id: `match-${event.id}`,
      date: event.date,
      time: event.kickoff_time,
      title: event.opponent,
      location: event.location,
      type: "Spiel",
      href: "/matches"
    }))
  ].sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`));

  return (
    <div className="space-y-6">
      <PageHeader
        description="Eine einfache Terminübersicht für Training und Spiel."
        title="Kalender"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays aria-hidden="true" className="h-5 w-5 text-primary" />
            Nächste Termine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length > 0 ? (
            events.map((event) => (
              <div
                className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={event.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={event.type === "Spiel" ? "success" : "secondary"}>
                      {event.type}
                    </Badge>
                    <p className="font-semibold">{event.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatDate(event.date)}
                    {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={event.href}>Öffnen</Link>
                </Button>
              </div>
            ))
          ) : (
            <EmptyState
              body="Trainings und Spiele erscheinen hier automatisch."
              title="Noch keine Termine."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
