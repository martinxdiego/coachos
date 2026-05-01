import Link from "next/link";
import { CalendarPlus, Save, UsersRound } from "lucide-react";
import {
  createMondayTraining,
  saveMondayAttendance,
  savePlayerEvaluation
} from "@/app/actions";
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
import { evaluationAverage } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface MondayPageProps {
  searchParams?: Promise<{
    category?: string;
    position?: string;
    year?: string;
    attendance?: string;
    rating?: string;
  }>;
}

export default async function MondayTrainingPage({
  searchParams
}: MondayPageProps) {
  const { supabase, team } = await requireActiveTeam();
  const params = await searchParams;
  const category = params?.category ?? "all";
  const position = params?.position ?? "all";
  const year = params?.year ?? "all";
  const attendanceFilter = params?.attendance ?? "all";
  const ratingFilter = params?.rating ?? "all";
  const today = todayIsoDate();

  const [playersResult, mondayResult, attendanceResult, evaluationsResult] =
    await Promise.all([
      supabase
        .from("players")
        .select("id,name,position,birth_year,team_category,status")
        .eq("team_id", team.id)
        .order("last_name", { ascending: true }),
      supabase
        .from("monday_trainings")
        .select("*")
        .eq("team_id", team.id)
        .order("date", { ascending: false })
        .limit(12),
      supabase
        .from("monday_attendance")
        .select("*")
        .eq("team_id", team.id),
      supabase
        .from("player_evaluations")
        .select("*")
        .eq("team_id", team.id)
        .eq("context_type", "monday_training")
        .order("evaluation_date", { ascending: false })
        .limit(500)
    ]);

  for (const result of [
    playersResult,
    mondayResult,
    attendanceResult,
    evaluationsResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const allPlayers = playersResult.data ?? [];
  const mondayTrainings = mondayResult.data ?? [];
  const selectedTraining = mondayTrainings[0] ?? null;
  const attendanceRows = attendanceResult.data ?? [];
  const evaluations = evaluationsResult.data ?? [];
  const latestAttendance = new Map(
    attendanceRows
      .filter((row) => row.monday_training_id === selectedTraining?.id)
      .map((row) => [row.player_id, row.status])
  );
  const categories = [
    ...new Set(allPlayers.map((player) => player.team_category).filter(Boolean))
  ] as string[];
  const positions = [
    ...new Set(allPlayers.map((player) => player.position).filter(Boolean))
  ] as string[];
  const years = [
    ...new Set(allPlayers.map((player) => player.birth_year).filter(Boolean))
  ].sort((a, b) => Number(a) - Number(b)) as number[];
  const mondayRatingByPlayer = new Map(
    allPlayers.map((player) => {
      const values = evaluations
        .filter((evaluation) => evaluation.player_id === player.id)
        .map(evaluationAverage)
        .filter((value): value is number => value !== null);
      const average =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null;
      return [player.id, average] as const;
    })
  );
  const players = allPlayers.filter((player) => {
    const attendance = latestAttendance.get(player.id) ?? "absent";
    const rating = mondayRatingByPlayer.get(player.id) ?? null;
    return (
      (category === "all" || player.team_category === category) &&
      (position === "all" || player.position === position) &&
      (year === "all" || String(player.birth_year) === year) &&
      (attendanceFilter === "all" || attendance === attendanceFilter) &&
      (ratingFilter === "all" ||
        (ratingFilter === "strong" && rating !== null && rating >= 4) ||
        (ratingFilter === "watch" && rating !== null && rating < 3) ||
        (ratingFilter === "missing" && rating === null))
    );
  });
  const filterHref = (next: Record<string, string>) => {
    const url = new URLSearchParams({
      category,
      position,
      year,
      attendance: attendanceFilter,
      rating: ratingFilter,
      ...next
    });
    return `/monday?${url.toString()}`;
  };
  const presentCount = allPlayers.filter(
    (player) => latestAttendance.get(player.id) === "present"
  ).length;
  const avgMondayEvaluation = (() => {
    const values = evaluations
      .map(evaluationAverage)
      .filter((value): value is number => value !== null);
    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        description="Separates Montagstraining fuer Spieler aus mehreren Kategorien mit Anwesenheit, Bewertung und Sändu-Auswertung."
        title="Montagstraining"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-950 text-white">
          <CardContent className="p-5">
            <UsersRound aria-hidden="true" className="h-5 w-5 text-emerald-300" />
            <p className="mt-3 text-sm text-slate-300">Spieler im Pool</p>
            <p className="mt-1 text-3xl font-semibold">{allPlayers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Letzte Anwesenheit</p>
            <p className="mt-1 text-3xl font-semibold">
              {presentCount}/{allPlayers.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Ø Bewertung Montag</p>
            <p className="mt-1 text-3xl font-semibold">
              {avgMondayEvaluation !== null
                ? avgMondayEvaluation.toFixed(1)
                : "-"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card className="border-emerald-200 bg-emerald-50/70">
            <CardHeader>
              <CardTitle>Montag planen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createMondayTraining} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monday-date">Datum</Label>
                    <Input
                      defaultValue={today}
                      id="monday-date"
                      name="date"
                      required
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monday-duration">Dauer</Label>
                    <Input
                      defaultValue="75"
                      id="monday-duration"
                      name="duration_minutes"
                      type="number"
                    />
                  </div>
                </div>
                <Input
                  name="topic"
                  placeholder="Technik, Athletik, individuelles Thema"
                  required
                />
                <Textarea name="goal" placeholder="Ziel des Montagstrainings" />
                <Textarea name="staff_notes" placeholder="Staff-Notizen" />
                <Textarea name="sandu_notes" placeholder="Sändu-Auswertung" />
                <Button className="w-full" type="submit">
                  <CalendarPlus aria-hidden="true" className="h-4 w-4" />
                  Training speichern
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  variant={category === "all" ? "default" : "outline"}
                >
                  <Link href={filterHref({ category: "all" })}>Alle Kategorien</Link>
                </Button>
                {categories.map((item) => (
                  <Button
                    asChild
                    key={item}
                    size="sm"
                    variant={category === item ? "default" : "outline"}
                  >
                    <Link href={filterHref({ category: item })}>{item}</Link>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  variant={position === "all" ? "default" : "outline"}
                >
                  <Link href={filterHref({ position: "all" })}>Alle Positionen</Link>
                </Button>
                {positions.map((item) => (
                  <Button
                    asChild
                    key={item}
                    size="sm"
                    variant={position === item ? "default" : "outline"}
                  >
                    <Link href={filterHref({ position: item })}>{item}</Link>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  variant={year === "all" ? "default" : "outline"}
                >
                  <Link href={filterHref({ year: "all" })}>Alle Jahrgänge</Link>
                </Button>
                {years.map((item) => (
                  <Button
                    asChild
                    key={item}
                    size="sm"
                    variant={year === String(item) ? "default" : "outline"}
                  >
                    <Link href={filterHref({ year: String(item) })}>{item}</Link>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "Alle Anwesenheiten"],
                  ["present", "Anwesend"],
                  ["absent", "Abwesend"],
                  ["injured", "Angeschlagen"]
                ].map(([value, label]) => (
                  <Button
                    asChild
                    key={value}
                    size="sm"
                    variant={attendanceFilter === value ? "default" : "outline"}
                  >
                    <Link href={filterHref({ attendance: value })}>{label}</Link>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "Alle Bewertungen"],
                  ["strong", "Stark"],
                  ["watch", "Beobachten"],
                  ["missing", "Ohne Bewertung"]
                ].map(([value, label]) => (
                  <Button
                    asChild
                    key={value}
                    size="sm"
                    variant={ratingFilter === value ? "default" : "outline"}
                  >
                    <Link href={filterHref({ rating: value })}>{label}</Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedTraining ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>{selectedTraining.topic}</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDate(selectedTraining.date)}
                      {selectedTraining.duration_minutes
                        ? ` · ${selectedTraining.duration_minutes} Min.`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">Letzte Einheit</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form action={saveMondayAttendance} className="space-y-4">
                  <input
                    name="monday_training_id"
                    type="hidden"
                    value={selectedTraining.id}
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    {players.map((player) => {
                      const status = latestAttendance.get(player.id);
                      return (
                        <div
                          className="rounded-xl border border-border bg-background/70 p-4"
                          key={player.id}
                        >
                          <input name="player_id" type="hidden" value={player.id} />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {player.name}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {player.position ?? "Position offen"}
                                {player.birth_year ? ` · ${player.birth_year}` : ""}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Montag Ø{" "}
                                {mondayRatingByPlayer.get(player.id) !== null
                                  ? mondayRatingByPlayer
                                      .get(player.id)
                                      ?.toFixed(1)
                                  : "offen"}
                              </p>
                            </div>
                            <Badge
                              variant={
                                status === "present"
                                  ? "success"
                                  : status === "injured"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {status ?? "offen"}
                            </Badge>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                            <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                              <input
                                defaultChecked={status === "present"}
                                name="present_player_id"
                                type="checkbox"
                                value={player.id}
                              />
                              Anwesend
                            </label>
                            <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                              <input
                                defaultChecked={status === "injured"}
                                name="injured_player_id"
                                type="checkbox"
                                value={player.id}
                              />
                              Angeschlagen
                            </label>
                          </div>
                          <Input
                            className="mt-3"
                            name={`note_${player.id}`}
                            placeholder="Kurznotiz"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <Button type="submit">
                    <Save aria-hidden="true" className="h-4 w-4" />
                    Anwesenheit speichern
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="Noch kein Montagstraining geplant." />
          )}

          {selectedTraining ? (
            <Card>
              <CardHeader>
                <CardTitle>Montagsbewertung erfassen</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={savePlayerEvaluation} className="grid gap-3 md:grid-cols-6">
                  <input
                    name="context_type"
                    type="hidden"
                    value="monday_training"
                  />
                  <input
                    name="context_id"
                    type="hidden"
                    value={selectedTraining.id}
                  />
                  <input
                    name="context_label"
                    type="hidden"
                    value={selectedTraining.topic}
                  />
                  <input
                    name="evaluation_date"
                    type="hidden"
                    value={selectedTraining.date}
                  />
                  <select
                    className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-span-2"
                    name="player_id"
                  >
                    {allPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                  {[
                    ["participation", "Beteiligung"],
                    ["motivation", "Motivation"],
                    ["training_quality", "Qualität"],
                    ["effort", "Einsatz"]
                  ].map(([name, label]) => (
                    <select
                      aria-label={label}
                      className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue="3"
                      key={name}
                      name={name}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ))}
                  <Textarea
                    className="md:col-span-5"
                    name="notes"
                    placeholder="Entwicklung im Montagstraining"
                  />
                  <Button className="md:col-span-1" type="submit">
                    Speichern
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
