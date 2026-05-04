import { Suspense } from "react";
import { CreateTrainingDrawer } from "@/components/create-training-drawer";
import { TrainingAiDraftDrawer } from "@/components/training-ai-drawer";
import { TrainingPresetDrawer } from "@/components/training-preset-drawer";
import { TrainingWeekAccordion } from "@/components/training-week-accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIsoDate } from "@/lib/utils";
import type { TrainingPhase } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TrainingsPageProps {
  searchParams?: Promise<{
    date?: string;
  }>;
}

function safeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIsoDate();
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function TrainingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-10" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            className="rounded-2xl border border-border/60 bg-card p-4"
            key={i}
          >
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function TrainingsData({ teamId }: { teamId: string }) {
  const supabase = await createClient();

  const [playersResult, trainingsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position")
      .eq("team_id", teamId)
      .order("name", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("*")
      .eq("team_id", teamId)
      .order("date", { ascending: false })
      .limit(250)
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

  const [attendanceResult, phasesResult] =
    trainingIds.length > 0
      ? await Promise.all([
          supabase
            .from("attendance")
            .select("training_id,player_id,status")
            .eq("team_id", teamId)
            .in("training_id", trainingIds),
          supabase
            .from("training_phases")
            .select("*")
            .eq("team_id", teamId)
            .in("training_id", trainingIds)
            .order("sort_order", { ascending: true })
        ])
      : [
          { data: [], error: null },
          { data: [], error: null }
        ];

  if (attendanceResult.error) {
    throw new Error(attendanceResult.error.message);
  }
  if (phasesResult.error) {
    throw new Error(phasesResult.error.message);
  }

  const attendanceRows = attendanceResult.data ?? [];
  const phases = (phasesResult.data ?? []) as TrainingPhase[];

  const today = todayIsoDate();
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  const day = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - day);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const startIso = startOfWeek.toISOString().slice(0, 10);
  const endIso = endOfWeek.toISOString().slice(0, 10);

  const stats = {
    total: trainings.length,
    thisWeek: trainings.filter(
      (t) => t.date >= startIso && t.date < endIso
    ).length,
    intensive: trainings.filter((t) => t.intensity === "high").length,
    upcoming: trainings.filter((t) => t.date >= today).length
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatTile label="Gesamt" value={stats.total} />
        <StatTile label="Diese Woche" value={stats.thisWeek} />
        <StatTile label="Intensiv" value={stats.intensive} />
        <StatTile label="Bevorstehend" value={stats.upcoming} />
      </div>

      <TrainingWeekAccordion
        attendanceRows={attendanceRows}
        phases={phases}
        players={players}
        trainings={trainings}
      />
    </div>
  );
}

export default async function TrainingsPage({ searchParams }: TrainingsPageProps) {
  const { team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const initialDate = safeDate(resolvedSearchParams?.date);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
            Workspace
          </p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
            Training
          </h1>
          <p className="text-[14px] leading-6 text-muted-foreground">
            Plane Einheiten mit Ziel, Belastung, Phasen, Material und
            Coachingpunkten.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-row-reverse sm:items-center">
          <CreateTrainingDrawer
            ageGroup={team.age_group}
            initialDate={initialDate}
          />
          <TrainingPresetDrawer initialDate={initialDate} />
          <TrainingAiDraftDrawer
            ageGroup={team.age_group}
            initialDate={initialDate}
          />
        </div>
      </div>

      <Suspense fallback={<TrainingsSkeleton />}>
        <TrainingsData teamId={team.id} />
      </Suspense>
    </div>
  );
}
