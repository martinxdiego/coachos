import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  HeartPulse,
  Medal,
  Save,
  Star,
  Trophy,
  UserRound
} from "lucide-react";
import {
  addFeedback,
  createExternalLink,
  savePlayerEvaluation,
  updatePlayer
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
import {
  evaluationAverage,
  healthRisk,
  winnerPointTotal
} from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, formatDateTime, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PlayerProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

const profileSections = [
  ["birth_date", "Geburtsdatum"],
  ["position", "Position"],
  ["team_category", "Team/Kategorie"],
  ["jersey_number", "Trikotnummer"],
  ["contact", "Kontakt"],
  ["emergency_contact", "Notfallkontakt"],
  ["strengths", "Stärken"],
  ["weaknesses", "Schwächen"],
  ["development_goals", "Entwicklungsziele"],
  ["medical_notes", "Medizinische Hinweise"]
] as const;

function selectClass() {
  return "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export default async function PlayerProfilePage({
  params
}: PlayerProfilePageProps) {
  const { id } = await params;
  const { supabase, team } = await requireActiveTeam();
  const [
    playerResult,
    feedbackResult,
    attendanceResult,
    pointsResult,
    evaluationsResult,
    healthResult,
    linksResult,
    awardsResult
  ] = await Promise.all([
    supabase
      .from("players")
      .select("*")
      .eq("id", id)
      .eq("team_id", team.id)
      .single(),
    supabase
      .from("player_feedback")
      .select("*")
      .eq("player_id", id)
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("attendance")
      .select("status")
      .eq("player_id", id)
      .eq("team_id", team.id),
    supabase
      .from("winner_points")
      .select("*")
      .eq("player_id", id)
      .eq("team_id", team.id)
      .order("awarded_at", { ascending: false })
      .limit(80),
    supabase
      .from("player_evaluations")
      .select("*")
      .eq("player_id", id)
      .eq("team_id", team.id)
      .order("evaluation_date", { ascending: false })
      .limit(30),
    supabase
      .from("health_checkins")
      .select("*")
      .eq("player_id", id)
      .eq("team_id", team.id)
      .order("checkin_date", { ascending: false })
      .limit(12),
    supabase
      .from("external_links")
      .select("*")
      .eq("player_id", id)
      .eq("team_id", team.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("player_awards")
      .select("*")
      .eq("player_id", id)
      .eq("team_id", team.id)
      .order("award_date", { ascending: false })
  ]);

  if (playerResult.error) {
    notFound();
  }

  for (const result of [
    feedbackResult,
    attendanceResult,
    pointsResult,
    evaluationsResult,
    healthResult,
    linksResult,
    awardsResult
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const player = playerResult.data;
  const feedback = feedbackResult.data ?? [];
  const attendance = attendanceResult.data ?? [];
  const points = pointsResult.data ?? [];
  const evaluations = evaluationsResult.data ?? [];
  const health = healthResult.data ?? [];
  const links = linksResult.data ?? [];
  const awards = awardsResult.data ?? [];
  const presentCount = attendance.filter((item) => item.status === "present").length;
  const attendanceRate =
    attendance.length > 0
      ? Math.round((presentCount / attendance.length) * 100)
      : null;
  const evaluationValues = evaluations
    .map(evaluationAverage)
    .filter((value): value is number => value !== null);
  const averageEvaluation =
    evaluationValues.length > 0
      ? evaluationValues.reduce((sum, value) => sum + value, 0) /
        evaluationValues.length
      : null;
  const latestHealth = health[0] ?? null;
  const latestHealthRisk = latestHealth ? healthRisk(latestHealth) : null;
  const missing = profileSections.filter(([key]) => {
    const value = player[key];
    return value === null || value === "";
  });
  const today = todayIsoDate();

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href="/players">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Zurück
            </Link>
          </Button>
        }
        description="Vollständiges Spieler-Portfolio mit Entwicklung, Gesundheit, Winnerpunkten, Kontakten und Quali-Links."
        title={player.name}
      />

      <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <Card className="overflow-hidden">
          <div className="h-44 bg-slate-950">
            {player.photo_url ? (
              <div
                aria-label={`Portrait von ${player.name}`}
                className="h-full w-full bg-cover bg-center"
                role="img"
                style={{ backgroundImage: `url(${player.photo_url})` }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white">
                <UserRound aria-hidden="true" className="h-14 w-14" />
              </div>
            )}
          </div>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={player.status === "available" ? "success" : "secondary"}>
                {player.status}
              </Badge>
              {player.strong_foot ? (
                <Badge variant="secondary">{player.strong_foot}</Badge>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-secondary px-3 py-2">
                <p className="text-xs text-muted-foreground">Position</p>
                <p className="font-semibold">{player.position ?? "Offen"}</p>
              </div>
              <div className="rounded-lg bg-secondary px-3 py-2">
                <p className="text-xs text-muted-foreground">Nummer</p>
                <p className="font-semibold">{player.jersey_number ?? "Offen"}</p>
              </div>
              <div className="rounded-lg bg-secondary px-3 py-2">
                <p className="text-xs text-muted-foreground">Winner</p>
                <p className="font-semibold">{winnerPointTotal(points)}</p>
              </div>
              <div className="rounded-lg bg-secondary px-3 py-2">
                <p className="text-xs text-muted-foreground">Bewertung</p>
                <p className="font-semibold">
                  {averageEvaluation !== null
                    ? `${averageEvaluation.toFixed(1)}/5`
                    : player.rating
                      ? `${player.rating}/10`
                      : "Offen"}
                </p>
              </div>
            </div>
            {missing.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">
                  Fehlende Daten
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {missing.slice(0, 8).map(([, label]) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-950">
                Saisonblatt vollständig.
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <Medal aria-hidden="true" className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Winnerpunkte</p>
              <p className="mt-1 text-3xl font-semibold">
                {winnerPointTotal(points)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <Star aria-hidden="true" className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Ø Bewertung</p>
              <p className="mt-1 text-3xl font-semibold">
                {averageEvaluation !== null ? averageEvaluation.toFixed(1) : "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <HeartPulse aria-hidden="true" className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Belastung</p>
              <p className="mt-1 text-3xl font-semibold">
                {latestHealthRisk === "red"
                  ? "Rot"
                  : latestHealthRisk === "yellow"
                    ? "Gelb"
                    : latestHealthRisk === "green"
                      ? "Grün"
                      : "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <Trophy aria-hidden="true" className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Awards</p>
              <p className="mt-1 text-3xl font-semibold">{awards.length}</p>
            </CardContent>
          </Card>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePlayer} className="space-y-5">
              <input name="id" type="hidden" value={player.id} />

              <details className="rounded-xl border border-border p-4" open>
                <summary className="cursor-pointer font-semibold">Basisdaten</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Vorname</Label>
                    <Input
                      defaultValue={player.first_name ?? ""}
                      id="first_name"
                      name="first_name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nachname</Label>
                    <Input
                      defaultValue={player.last_name ?? ""}
                      id="last_name"
                      name="last_name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth_date">Geburtsdatum</Label>
                    <Input
                      defaultValue={player.birth_date ?? ""}
                      id="birth_date"
                      name="birth_date"
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth_year">Jahrgang</Label>
                    <Input
                      defaultValue={player.birth_year ?? ""}
                      id="birth_year"
                      name="birth_year"
                      type="number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      defaultValue={player.position ?? ""}
                      id="position"
                      name="position"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team_category">Team/Kategorie</Label>
                    <Input
                      defaultValue={player.team_category ?? ""}
                      id="team_category"
                      name="team_category"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jersey_number">Trikotnummer</Label>
                    <Input
                      defaultValue={player.jersey_number ?? ""}
                      id="jersey_number"
                      name="jersey_number"
                      type="number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="strong_foot">Bevorzugter Fuss</Label>
                    <select
                      className={selectClass()}
                      defaultValue={player.strong_foot ?? ""}
                      id="strong_foot"
                      name="strong_foot"
                    >
                      <option value="">Offen</option>
                      <option value="left">Links</option>
                      <option value="right">Rechts</option>
                      <option value="both">Beidfüssig</option>
                    </select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="photo_url">Foto / Portrait URL</Label>
                    <Input
                      defaultValue={player.photo_url ?? ""}
                      id="photo_url"
                      name="photo_url"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height_cm">Grösse cm</Label>
                    <Input
                      defaultValue={player.height_cm ?? ""}
                      id="height_cm"
                      name="height_cm"
                      type="number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight_kg">Gewicht kg</Label>
                    <Input
                      defaultValue={player.weight_kg ?? ""}
                      id="weight_kg"
                      name="weight_kg"
                      step="0.1"
                      type="number"
                    />
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">Kontakt</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="contact">Kontaktangaben</Label>
                    <Textarea
                      defaultValue={player.contact ?? ""}
                      id="contact"
                      name="contact"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent_contact">Elternkontakt</Label>
                    <Textarea
                      defaultValue={player.parent_contact ?? ""}
                      id="parent_contact"
                      name="parent_contact"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact">Notfallkontakt</Label>
                    <Textarea
                      defaultValue={player.emergency_contact ?? ""}
                      id="emergency_contact"
                      name="emergency_contact"
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor="player_account_email">
                      Spieler-Login E-Mail
                    </Label>
                    <Input
                      defaultValue={player.player_account_email ?? ""}
                      id="player_account_email"
                      name="player_account_email"
                      placeholder="spieler@example.com"
                      type="email"
                    />
                    <p className="text-xs text-muted-foreground">
                      Diese Zuordnung bereitet den eigenen Spielerzugang vor.
                      Im Spieler-Modus kann später automatisch nur dieses
                      Portfolio geladen werden.
                    </p>
                  </div>
                </div>
              </details>

              <details className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">Persönliche Infos</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <Input
                    defaultValue={player.favorite_team ?? ""}
                    name="favorite_team"
                    placeholder="Lieblingsteam"
                  />
                  <Input
                    defaultValue={player.favorite_player ?? ""}
                    name="favorite_player"
                    placeholder="Lieblingsspieler"
                  />
                  <Input
                    defaultValue={player.motivation ?? ""}
                    name="motivation"
                    placeholder="Motivation"
                  />
                  <Textarea
                    defaultValue={player.football_goals ?? ""}
                    name="football_goals"
                    placeholder="Fussballziele"
                  />
                  <Textarea
                    defaultValue={player.strengths ?? ""}
                    name="strengths"
                    placeholder="Stärken"
                  />
                  <Textarea
                    defaultValue={player.weaknesses ?? ""}
                    name="weaknesses"
                    placeholder="Schwächen"
                  />
                  <Textarea
                    className="lg:col-span-3"
                    defaultValue={player.development_goals ?? ""}
                    name="development_goals"
                    placeholder="Saisonziele / Entwicklung"
                  />
                </div>
              </details>

              <details className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">Medizin und Belastung</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <Textarea
                    defaultValue={player.allergies ?? ""}
                    name="allergies"
                    placeholder="Allergien"
                  />
                  <Textarea
                    defaultValue={player.injuries ?? ""}
                    name="injuries"
                    placeholder="Verletzungen"
                  />
                  <Textarea
                    defaultValue={player.limitations ?? ""}
                    name="limitations"
                    placeholder="Einschränkungen"
                  />
                  <Textarea
                    defaultValue={player.medications ?? ""}
                    name="medications"
                    placeholder="Medikamente"
                  />
                  <Textarea
                    defaultValue={player.medical_notes ?? ""}
                    name="medical_notes"
                    placeholder="Medizinische Hinweise"
                  />
                  <Textarea
                    defaultValue={player.coach_alerts ?? ""}
                    name="coach_alerts"
                    placeholder="Wichtige Hinweise für Trainer"
                  />
                </div>
              </details>

              <details className="rounded-xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">Trainerdaten</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      className={selectClass()}
                      defaultValue={player.status}
                      id="status"
                      name="status"
                    >
                      <option value="available">Fit</option>
                      <option value="limited">Aufbau</option>
                      <option value="injured">Verletzt</option>
                      <option value="absent">Abwesend</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">Basisbewertung</Label>
                    <Input
                      defaultValue={player.rating ?? ""}
                      id="rating"
                      max={10}
                      min={1}
                      name="rating"
                      type="number"
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="secondary_positions">Weitere Positionen</Label>
                    <Input
                      defaultValue={player.secondary_positions?.join(", ") ?? ""}
                      id="secondary_positions"
                      name="secondary_positions"
                    />
                  </div>
                  <Textarea
                    className="lg:col-span-2"
                    defaultValue={player.training_notes ?? ""}
                    name="training_notes"
                    placeholder="Trainingsnotizen"
                  />
                  <Textarea
                    className="lg:col-span-2"
                    defaultValue={player.personal_notes ?? ""}
                    name="personal_notes"
                    placeholder="Persönliche Notizen"
                  />
                  <Textarea
                    className="lg:col-span-4"
                    defaultValue={player.notes ?? ""}
                    name="notes"
                    placeholder="Allgemeine Notizen"
                  />
                </div>
              </details>

              <label className="flex items-center gap-2 text-sm">
                <input
                  defaultChecked={Boolean(player.season_form_completed_at)}
                  name="season_form_completed"
                  type="checkbox"
                />
                Digitales Saisonblatt ist vollständig ausgefüllt
              </label>

              <Button type="submit">
                <Save aria-hidden="true" className="h-4 w-4" />
                Portfolio speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bewertung erfassen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={savePlayerEvaluation} className="space-y-3">
                <input name="player_id" type="hidden" value={player.id} />
                <input name="evaluation_date" type="hidden" value={today} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className={selectClass()} name="context_type">
                    <option value="training">Training</option>
                    <option value="match">Spiel</option>
                    <option value="event">Event</option>
                    <option value="monday_training">Montag</option>
                  </select>
                  <Input name="context_label" placeholder="Kontext" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["participation", "Beteiligung"],
                    ["motivation", "Motivation"],
                    ["training_quality", "Qualität"],
                    ["behavior", "Verhalten"],
                    ["effort", "Einsatz"],
                    ["concentration", "Fokus"]
                  ].map(([name, label]) => (
                    <select
                      aria-label={label}
                      className={selectClass()}
                      defaultValue="3"
                      key={name}
                      name={name}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {label} {value}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
                <Textarea name="notes" placeholder="Feedbacknotiz" />
                <Button className="w-full" type="submit">
                  <Star aria-hidden="true" className="h-4 w-4" />
                  Bewertung speichern
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quali-Link hinzufügen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createExternalLink} className="space-y-3">
                <input name="player_id" type="hidden" value={player.id} />
                <Input name="title" placeholder="Titel" required />
                <Input name="url" placeholder="https://..." required />
                <select className={selectClass()} name="link_type">
                  <option value="player_stats">Spielerstatistik</option>
                  <option value="quali_document">Quali-Dokument</option>
                  <option value="meeting_notes">Gesprächsnotiz</option>
                  <option value="clubcorner">Clubcorner</option>
                  <option value="other">Sonstiges</option>
                </select>
                <Textarea name="notes" placeholder="Notiz" />
                <Button className="w-full" type="submit" variant="secondary">
                  Link speichern
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Altes Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addFeedback} className="space-y-3">
                <input name="player_id" type="hidden" value={player.id} />
                <select className={selectClass()} defaultValue="7" name="rating">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(
                    (rating) => (
                      <option key={rating} value={rating}>
                        {rating}/10
                      </option>
                    )
                  )}
                </select>
                <Textarea name="notes" placeholder="Kurzes Feedback" required />
                <Button className="w-full" type="submit" variant="outline">
                  Feedback speichern
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Bewertungsverlauf</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {evaluations.length > 0 ? (
              evaluations.slice(0, 5).map((item) => (
                <div className="rounded-xl border border-border p-3" key={item.id}>
                  <Badge variant="success">
                    {evaluationAverage(item)?.toFixed(1) ?? "-"} / 5
                  </Badge>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(item.evaluation_date)} · {item.context_type}
                  </p>
                  {item.notes ? (
                    <p className="mt-2 text-sm leading-6">{item.notes}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="Noch keine Bewertungen." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gesundheitsverlauf</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.length > 0 ? (
              health.slice(0, 5).map((item) => {
                const risk = healthRisk(item);
                return (
                  <div className="rounded-xl border border-border p-3" key={item.id}>
                    <Badge
                      variant={
                        risk === "red"
                          ? "destructive"
                          : risk === "yellow"
                            ? "secondary"
                            : "success"
                      }
                    >
                      {risk}
                    </Badge>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(item.checkin_date)}
                    </p>
                    <p className="mt-2 text-sm">
                      Energie {item.energy}/5 · Schmerzen {item.pain}/5
                    </p>
                  </div>
                );
              })
            ) : (
              <EmptyState title="Noch keine Check-ins." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Winnerpunkte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {points.length > 0 ? (
              points.slice(0, 5).map((point) => (
                <div className="rounded-xl border border-border p-3" key={point.id}>
                  <Badge variant="success">+{point.points}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(point.awarded_at)} · {point.context_type}
                  </p>
                  {point.reason ? (
                    <p className="mt-2 text-sm leading-6">{point.reason}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="Noch keine Winnerpunkte." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links & Awards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {links.map((link) => (
              <a
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-sm"
                href={link.url}
                key={link.id}
                rel="noreferrer"
                target="_blank"
              >
                <span>{link.title}</span>
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            ))}
            {awards.map((award) => (
              <div className="rounded-xl border border-border p-3" key={award.id}>
                <Badge variant="success">Hut</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDate(award.award_date)}
                </p>
                <p className="mt-2 text-sm">{award.reason ?? "Auszeichnung"}</p>
              </div>
            ))}
            {links.length === 0 && awards.length === 0 ? (
              <EmptyState title="Noch keine Links oder Awards." />
            ) : null}
          </CardContent>
        </Card>
      </section>

      {feedback.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Historische Feedbacknotizen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {feedback.map((item) => (
              <div className="rounded-xl border border-border p-4" key={item.id}>
                <Badge variant="secondary">{item.rating}/10</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(item.created_at)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {item.notes}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
