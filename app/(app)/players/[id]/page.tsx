import Link from "next/link";
import { ArrowLeft, Save, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { addFeedback, updatePlayer } from "@/app/actions";
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
import { requireActiveTeam } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PlayerProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PlayerProfilePage({
  params
}: PlayerProfilePageProps) {
  const { id } = await params;
  const { supabase, team } = await requireActiveTeam();
  const [playerResult, feedbackResult, attendanceResult] = await Promise.all([
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
      .eq("team_id", team.id)
  ]);

  if (playerResult.error) {
    notFound();
  }

  if (feedbackResult.error) {
    throw new Error(feedbackResult.error.message);
  }

  if (attendanceResult.error) {
    throw new Error(attendanceResult.error.message);
  }

  const player = playerResult.data;
  const feedback = feedbackResult.data ?? [];
  const attendance = attendanceResult.data ?? [];
  const presentCount = attendance.filter((item) => item.status === "present").length;
  const attendanceRate =
    attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : null;

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
        description="Detailprofil, Entwicklung, Kontakte, Gesundheit und Feedback."
        title={player.name}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Position</p>
            <p className="mt-2 text-2xl font-semibold">
              {player.position ?? "Offen"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Jahrgang</p>
            <p className="mt-2 text-2xl font-semibold">
              {player.birth_year ?? "Offen"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Bewertung</p>
            <p className="mt-2 text-2xl font-semibold">
              {player.rating ? `${player.rating}/10` : "Offen"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Anwesenheit</p>
            <p className="mt-2 text-2xl font-semibold">
              {attendanceRate !== null ? `${attendanceRate}%` : "Offen"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Detailprofil bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePlayer} className="space-y-5">
              <input name="id" type="hidden" value={player.id} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <Label htmlFor="position">Position</Label>
                  <Input
                    defaultValue={player.position ?? ""}
                    id="position"
                    name="position"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jersey_number">Nummer</Label>
                  <Input
                    defaultValue={player.jersey_number ?? ""}
                    id="jersey_number"
                    name="jersey_number"
                    type="number"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <Label htmlFor="strong_foot">Starker Fuss</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <Label htmlFor="rating">Bewertung</Label>
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
                    placeholder="RV, DM, RA"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact">Kontakt</Label>
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
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="strengths">Stärken</Label>
                  <Textarea
                    defaultValue={player.strengths ?? ""}
                    id="strengths"
                    name="strengths"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weaknesses">Schwächen</Label>
                  <Textarea
                    defaultValue={player.weaknesses ?? ""}
                    id="weaknesses"
                    name="weaknesses"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="development_goals">Entwicklungsziele</Label>
                  <Textarea
                    defaultValue={player.development_goals ?? ""}
                    id="development_goals"
                    name="development_goals"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="training_notes">Trainingsnotizen</Label>
                  <Textarea
                    defaultValue={player.training_notes ?? ""}
                    id="training_notes"
                    name="training_notes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical_notes">Medizinische Hinweise</Label>
                  <Textarea
                    defaultValue={player.medical_notes ?? ""}
                    id="medical_notes"
                    name="medical_notes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personal_notes">Persönliche Notizen</Label>
                  <Textarea
                    defaultValue={player.personal_notes ?? ""}
                    id="personal_notes"
                    name="personal_notes"
                  />
                </div>
              </div>

              <Button type="submit">
                <Save aria-hidden="true" className="h-4 w-4" />
                Profil speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feedback hinzufügen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addFeedback} className="space-y-4">
                <input name="player_id" type="hidden" value={player.id} />
                <div className="space-y-2">
                  <Label htmlFor="feedback-rating">Rating</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="7"
                    id="feedback-rating"
                    name="rating"
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map(
                      (rating) => (
                        <option key={rating} value={rating}>
                          {rating}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback-notes">Notiz</Label>
                  <Textarea id="feedback-notes" name="notes" required />
                </div>
                <Button type="submit">
                  <Star aria-hidden="true" className="h-4 w-4" />
                  Feedback speichern
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feedback-Verlauf</CardTitle>
            </CardHeader>
            <CardContent>
              {feedback.length > 0 ? (
                <div className="space-y-3">
                  {feedback.map((item) => (
                    <div
                      className="rounded-xl border border-border bg-background/70 px-4 py-3"
                      key={item.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="success">{item.rating}/10</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                        {item.notes}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Noch kein Feedback." />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
