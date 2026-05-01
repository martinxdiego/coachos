import { Bot, Copy } from "lucide-react";
import {
  createAiTrainingDraft,
  createPresetTraining
} from "@/app/actions";
import { CreateTrainingDrawer } from "@/components/create-training-drawer";
import { PageHeader } from "@/components/page-header";
import { TrainingWeekAccordion } from "@/components/training-week-accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireActiveTeam } from "@/lib/auth";
import { todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TrainingsPageProps {
  searchParams?: Promise<{
    date?: string;
  }>;
}

function safeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIsoDate();
}

export default async function TrainingsPage({ searchParams }: TrainingsPageProps) {
  const { supabase, team } = await requireActiveTeam();
  const resolvedSearchParams = await searchParams;
  const initialDate = safeDate(resolvedSearchParams?.date);

  const [playersResult, trainingsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position")
      .eq("team_id", team.id)
      .order("name", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("*")
      .eq("team_id", team.id)
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
            .eq("team_id", team.id)
            .in("training_id", trainingIds),
          supabase
            .from("training_phases")
            .select("*")
            .eq("team_id", team.id)
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
  const phases = phasesResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Plane Einheiten mit Ziel, Belastung, Phasen, Material und Coachingpunkten."
        title="Training"
      />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <aside className="space-y-4">
          <CreateTrainingDrawer
            ageGroup={team.age_group}
            initialDate={initialDate}
          />

          <Card>
            <CardHeader>
              <CardTitle>Vorlagen-Bibliothek</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createPresetTraining} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="preset">Vorlage</Label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      id="preset"
                      name="preset"
                    >
                      <option value="pressing">Pressing nach Ballverlust</option>
                      <option value="buildup">Spielaufbau gegen Pressing</option>
                      <option value="finishing">Abschluss unter Druck</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preset-date">Datum</Label>
                    <Input
                      defaultValue={initialDate}
                      id="preset-date"
                      name="date"
                      required
                      type="date"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <Input name="start_time" type="time" />
                  <Input
                    defaultValue="90"
                    name="duration_minutes"
                    type="number"
                  />
                  <Input name="location" placeholder="Ort" />
                </div>
                <Button className="w-full" type="submit" variant="secondary">
                  <Copy aria-hidden="true" className="h-4 w-4" />
                  Vorlage erstellen
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KI-Trainingsentwurf</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createAiTrainingDraft} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ai-date">Datum</Label>
                  <Input
                    defaultValue={initialDate}
                    id="ai-date"
                    name="date"
                    required
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-focus">Ziel / Schwerpunkt</Label>
                  <Input
                    id="ai-focus"
                    name="focus"
                    placeholder="Spielaufbau gegen Pressing"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    defaultValue={team.age_group ?? ""}
                    name="age_group"
                    placeholder="U16"
                  />
                  <Input
                    defaultValue="90"
                    name="duration_minutes"
                    type="number"
                  />
                </div>
                <Button className="w-full" type="submit" variant="secondary">
                  <Bot aria-hidden="true" className="h-4 w-4" />
                  KI-Draft erzeugen
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Erstellt aktuell einen strukturierten Mock-Entwurf. Die Action
                  ist vorbereitet für echte Modellintegration.
                </p>
              </form>
            </CardContent>
          </Card>
        </aside>

        <TrainingWeekAccordion
          attendanceRows={attendanceRows}
          phases={phases}
          players={players}
          trainings={trainings}
        />
      </section>
    </div>
  );
}
