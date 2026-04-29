import { CalendarPlus, Save } from "lucide-react";
import { createTraining, saveAttendance } from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrainingsPage() {
  const { supabase, user } = await requireUser();
  const [playersResult, trainingsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("id,date,focus,notes")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(20)
  ]);

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  if (trainingsResult.error) {
    throw new Error(trainingsResult.error.message);
  }

  const players = playersResult.data ?? [];
  const trainings = trainingsResult.data ?? [];
  const trainingIds = trainings.map((training) => training.id);

  const attendanceResult =
    trainingIds.length > 0
      ? await supabase
          .from("attendance")
          .select("training_id,player_id,status")
          .eq("user_id", user.id)
          .in("training_id", trainingIds)
      : { data: [], error: null };

  if (attendanceResult.error) {
    throw new Error(attendanceResult.error.message);
  }

  const attendanceByTraining = new Map<string, Map<string, AttendanceStatus>>();

  for (const row of attendanceResult.data ?? []) {
    const playerMap =
      attendanceByTraining.get(row.training_id) ??
      new Map<string, AttendanceStatus>();
    playerMap.set(row.player_id, row.status);
    attendanceByTraining.set(row.training_id, playerMap);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Plan sessions and record attendance."
        title="Training"
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Create session</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTraining} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  defaultValue={todayIsoDate()}
                  id="date"
                  name="date"
                  required
                  type="date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="focus">Focus</Label>
                <Input id="focus" name="focus" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <Button className="w-full" type="submit">
                <CalendarPlus aria-hidden="true" className="h-4 w-4" />
                Create session
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {trainings.length > 0 ? (
            trainings.map((training) => {
              const attendance =
                attendanceByTraining.get(training.id) ??
                new Map<string, AttendanceStatus>();
              const presentCount = players.filter(
                (player) => attendance.get(player.id) === "present"
              ).length;

              return (
                <Card key={training.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{training.focus}</CardTitle>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatDate(training.date)}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {presentCount}/{players.length} present
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {training.notes ? (
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {training.notes}
                      </p>
                    ) : null}

                    {players.length > 0 ? (
                      <form action={saveAttendance} className="space-y-4">
                        <input
                          name="training_id"
                          type="hidden"
                          value={training.id}
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          {players.map((player) => {
                            const status = attendance.get(player.id);

                            return (
                              <label
                                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3 text-sm"
                                key={player.id}
                              >
                                <input
                                  name="player_id"
                                  type="hidden"
                                  value={player.id}
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {player.name}
                                  </span>
                                  {player.position ? (
                                    <span className="text-xs text-muted-foreground">
                                      {player.position}
                                    </span>
                                  ) : null}
                                </span>
                                <input
                                  className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                                  defaultChecked={status === "present"}
                                  name="present_player_id"
                                  type="checkbox"
                                  value={player.id}
                                />
                              </label>
                            );
                          })}
                        </div>
                        <Button type="submit" variant="secondary">
                          <Save aria-hidden="true" className="h-4 w-4" />
                          Save attendance
                        </Button>
                      </form>
                    ) : (
                      <EmptyState title="Add players before tracking attendance." />
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <EmptyState title="No training sessions yet." />
          )}
        </div>
      </div>
    </div>
  );
}
