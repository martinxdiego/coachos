import Link from "next/link";
import { AlertTriangle, HeartPulse, Save, ShieldCheck, Trash2 } from "lucide-react";
import {
  deleteHealthCheckin,
  saveHealthCheckin,
  updateHealthCheckin
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
import { healthRisk } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const checks = [
  ["fatigue", "Müdigkeit", "1 frisch · 5 sehr müde"],
  ["sleep_quality", "Schlafqualität", "1 schlecht · 5 top"],
  ["soreness", "Muskelkater", "1 keiner · 5 stark"],
  ["pain", "Schmerzen", "1 keine · 5 stark"],
  ["stress", "Stress", "1 tief · 5 hoch"],
  ["motivation", "Motivation", "1 tief · 5 hoch"],
  ["energy", "Energielevel", "1 tief · 5 hoch"],
  ["injury_feeling", "Verletzungsgefühl", "1 keines · 5 stark"],
  ["wellbeing", "Wohlbefinden", "1 schlecht · 5 top"]
] as const;

const riskMeta = {
  green: {
    badge: "success" as const,
    label: "Grün",
    text: "Normal belastbar"
  },
  red: {
    badge: "destructive" as const,
    label: "Rot",
    text: "Belastung prüfen"
  },
  yellow: {
    badge: "secondary" as const,
    label: "Gelb",
    text: "Aufmerksam steuern"
  }
};

export default async function HealthPage() {
  const { supabase, team } = await requireActiveTeam();
  const today = todayIsoDate();
  const [playersResult, checkinsResult] = await Promise.all([
    supabase
      .from("players")
      .select("id,name,position,team_category,status,medical_notes,coach_alerts")
      .eq("team_id", team.id)
      .order("last_name", { ascending: true }),
    supabase
      .from("health_checkins")
      .select("*")
      .eq("team_id", team.id)
      .order("checkin_date", { ascending: false })
      .limit(500)
  ]);

  if (playersResult.error) {
    throw new Error(playersResult.error.message);
  }

  if (checkinsResult.error) {
    throw new Error(checkinsResult.error.message);
  }

  const players = playersResult.data ?? [];
  const checkins = checkinsResult.data ?? [];
  const latestByPlayer = new Map(
    players.map((player) => [
      player.id,
      checkins.find((checkin) => checkin.player_id === player.id) ?? null
    ])
  );
  const warningRows = players
    .map((player) => {
      const checkin = latestByPlayer.get(player.id);
      return checkin ? { player, checkin, risk: healthRisk(checkin) } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => row.risk !== "green");

  return (
    <div className="space-y-6">
      <PageHeader
        description="Belastungs-Check mit Ampelwarnungen fuer Training und Spiel."
        title="Gesundheit / Belastung"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-950 text-white">
          <CardContent className="p-5">
            <HeartPulse aria-hidden="true" className="h-5 w-5 text-emerald-300" />
            <p className="mt-3 text-sm text-slate-300">Check-ins</p>
            <p className="mt-1 text-3xl font-semibold">{checkins.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 text-red-700" />
            <p className="mt-3 text-sm text-muted-foreground">Warnungen</p>
            <p className="mt-1 text-3xl font-semibold">{warningRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Heute</p>
            <p className="mt-1 text-3xl font-semibold">
              {
                checkins.filter((checkin) => checkin.checkin_date === today)
                  .length
              }
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[430px_1fr]">
        <Card className="h-fit border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Check-in erfassen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveHealthCheckin} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="health-player">Spieler</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="health-player"
                    name="player_id"
                    required
                  >
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="health-date">Datum</Label>
                  <Input
                    defaultValue={today}
                    id="health-date"
                    name="checkin_date"
                    type="date"
                  />
                </div>
              </div>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue="training"
                name="context_type"
              >
                <option value="training">Vor Training</option>
                <option value="match">Vor Spiel</option>
                <option value="free">Freier Check</option>
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                {checks.map(([name, label, hint]) => (
                  <div className="space-y-2" key={name}>
                    <Label htmlFor={`health-${name}`}>{label}</Label>
                    <select
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue="3"
                      id={`health-${name}`}
                      name={name}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                ))}
              </div>
              <Textarea name="notes" placeholder="Schmerzen, Hinweise, Anpassung" />
              <Button className="w-full" type="submit">
                Check-in speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teamübersicht</CardTitle>
          </CardHeader>
          <CardContent>
            {players.length > 0 ? (
              <div className="grid gap-3">
                {players.map((player) => {
                  const latest = latestByPlayer.get(player.id);
                  const risk = latest ? healthRisk(latest) : null;
                  const meta = risk ? riskMeta[risk] : null;

                  return (
                    <div
                      className="grid gap-3 rounded-xl border border-border bg-background/70 p-4 lg:grid-cols-[1.1fr_0.7fr_1.2fr_auto]"
                      key={player.id}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{player.name}</p>
                          {meta ? (
                            <Badge variant={meta.badge}>{meta.label}</Badge>
                          ) : (
                            <Badge variant="outline">Kein Check</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {player.position ?? "Position offen"}
                          {player.team_category
                            ? ` · ${player.team_category}`
                            : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Datum</p>
                        <p className="mt-1 text-sm font-medium">
                          {latest ? formatDate(latest.checkin_date) : "Offen"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Belastung
                        </p>
                        <p className="mt-1 text-sm">
                          {meta?.text ?? "Noch keine Einschätzung"}
                        </p>
                        {latest ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Müdigkeit {latest.fatigue}/5 · Energie{" "}
                            {latest.energy}/5 · Schmerzen {latest.pain}/5
                          </p>
                        ) : null}
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/players/${player.id}`}>Verlauf</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Noch keine Spieler fuer den Belastungs-Check." />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Check-ins bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          {checkins.length > 0 ? (
            <div className="grid gap-3">
              {checkins.slice(0, 12).map((checkin) => {
                const player = players.find((item) => item.id === checkin.player_id);
                const risk = healthRisk(checkin);

                return (
                  <details
                    className="rounded-xl border border-border bg-background/70 p-4"
                    key={checkin.id}
                  >
                    <summary className="cursor-pointer">
                      <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="font-semibold">
                            {player?.name ?? "Unbekannter Spieler"}
                          </span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {formatDate(checkin.checkin_date)} ·{" "}
                            {checkin.context_type}
                          </span>
                        </span>
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
                      </span>
                    </summary>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_auto]">
                      <form action={updateHealthCheckin} className="space-y-4">
                        <input name="id" type="hidden" value={checkin.id} />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Spieler</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={checkin.player_id}
                              name="player_id"
                            >
                              {players.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Datum</Label>
                            <Input
                              defaultValue={checkin.checkin_date}
                              name="checkin_date"
                              type="date"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Kontext</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={checkin.context_type}
                              name="context_type"
                            >
                              <option value="training">Training</option>
                              <option value="match">Spiel</option>
                              <option value="free">Frei</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {checks.map(([name, label]) => (
                            <div className="space-y-2" key={name}>
                              <Label>{label}</Label>
                              <select
                                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                defaultValue={String(checkin[name])}
                                name={name}
                              >
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <Textarea
                          defaultValue={checkin.notes ?? ""}
                          name="notes"
                          placeholder="Hinweis"
                        />
                        <Button type="submit">
                          <Save aria-hidden="true" className="h-4 w-4" />
                          Speichern
                        </Button>
                      </form>
                      <form action={deleteHealthCheckin}>
                        <input name="id" type="hidden" value={checkin.id} />
                        <input
                          name="player_id"
                          type="hidden"
                          value={checkin.player_id}
                        />
                        <Button
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          type="submit"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Löschen
                        </Button>
                      </form>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Noch keine Check-ins zum Bearbeiten." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
