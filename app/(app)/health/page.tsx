import { AlertTriangle, HeartPulse, Save, ShieldCheck, Trash2 } from "lucide-react";
import {
  deleteHealthCheckin,
  saveHealthCheckin,
  updateHealthCheckin
} from "@/app/actions";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { HealthRoster, type HealthRow } from "@/components/health-roster";
import { PageHeader } from "@/components/page-header";
import { ScoreScale } from "@/components/score-scale";
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
import { calculatePredictiveInjuryRisk } from "@/lib/predictive-health";
import { requireActiveTeam } from "@/lib/auth";
import { formatDate, todayIsoDate } from "@/lib/utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Direction = "low-good" | "high-good";

const checks: ReadonlyArray<readonly [string, string, string, Direction]> = [
  ["fatigue", "Müdigkeit", "1 frisch · 5 sehr müde", "low-good"],
  ["sleep_quality", "Schlafqualität", "1 schlecht · 5 top", "high-good"],
  ["soreness", "Muskelkater", "1 keiner · 5 stark", "low-good"],
  ["pain", "Schmerzen", "1 keine · 5 stark", "low-good"],
  ["stress", "Stress", "1 tief · 5 hoch", "low-good"],
  ["motivation", "Motivation", "1 tief · 5 hoch", "high-good"],
  ["energy", "Energielevel", "1 tief · 5 hoch", "high-good"],
  ["injury_feeling", "Verletzungsgefühl", "1 keines · 5 stark", "low-good"],
  ["wellbeing", "Wohlbefinden", "1 schlecht · 5 top", "high-good"]
];

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
  const { team } = await requireActiveTeam();
  const t = await getTranslations("pages");
  const today = todayIsoDate();

  const playersData = await db.player.findMany({
    where: { workspaceId: team.id },
    select: {
      id: true,
      name: true,
      position: true,
      status: true,
      medicalNotes: true,
      coachAlerts: true,
      firstName: true,
      lastName: true
    },
    orderBy: [
      { lastName: "asc" },
      { name: "asc" }
    ]
  });

  const checkinsData = await db.healthCheck.findMany({
    where: {
      player: {
        workspaceId: team.id
      }
    },
    select: {
      id: true,
      playerId: true,
      date: true,
      contextType: true,
      fatigue: true,
      sleepQuality: true,
      soreness: true,
      pain: true,
      stress: true,
      motivation: true,
      energy: true,
      injuryFeeling: true,
      wellbeing: true,
      notes: true
    },
    orderBy: {
      date: "desc"
    },
    take: 500
  });

  const players = playersData.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    team_category: null,
    status: p.status.toLowerCase() as any,
    medical_notes: p.medicalNotes,
    coach_alerts: p.coachAlerts
  }));

  const checkins = checkinsData.map((c) => ({
    id: c.id,
    player_id: c.playerId,
    checkin_date: c.date.toISOString().slice(0, 10),
    context_type: c.contextType ?? "training",
    fatigue: c.fatigue,
    sleep_quality: c.sleepQuality ?? 3,
    soreness: c.soreness,
    pain: c.pain,
    stress: c.stress,
    motivation: c.motivation,
    energy: c.energy ?? 3,
    injury_feeling: c.injuryFeeling ?? 1,
    wellbeing: c.wellbeing ?? 3,
    notes: c.notes
  }));

  const latestByPlayer = new Map(
    players.map((player) => [
      player.id,
      checkins.find((checkin) => checkin.player_id === player.id) ?? null
    ])
  );

  const predictiveRisks = await Promise.all(
    players.map(async (player) => {
      const result = await calculatePredictiveInjuryRisk(player.id, team.id);
      return { playerId: player.id, result };
    })
  );
  const predictiveRiskMap = new Map(predictiveRisks.map((pr) => [pr.playerId, pr.result]));

  const warningRows = players
    .map((player) => {
      const pred = predictiveRiskMap.get(player.id);
      const checkin = latestByPlayer.get(player.id);
      return pred && pred.risk !== "green" ? { player, checkin, risk: pred.risk } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const rosterRows: HealthRow[] = players.map((player) => {
    const latest = latestByPlayer.get(player.id);
    const pred = predictiveRiskMap.get(player.id)!;
    const risk = pred.risk;
    const meta = risk ? riskMeta[risk] : null;
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      category: player.team_category,
      risk,
      riskLabel: meta?.label ?? "Offen",
      riskScore: pred.score,
      checkinDate: latest ? latest.checkin_date : null,
      fatigue: latest ? latest.fatigue : null,
      energy: latest ? latest.energy : null,
      pain: latest ? latest.pain : null,
      predictiveReasons: pred.reasons,
      predictiveRecommendation: pred.recommendation
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("health_desc")}
        title={t("health_title")}
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
                {checks.map(([name, label, hint, direction]) => (
                  <ScoreScale
                    defaultValue={3}
                    direction={direction}
                    hint={hint}
                    key={name}
                    label={label}
                    name={name}
                  />
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Teamübersicht</CardTitle>
              <p className="text-[12px] text-muted-foreground">
                Filtere und sortiere nach Belastung – Rot zuerst.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {players.length > 0 ? (
              <HealthRoster rows={rosterRows} />
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
                          {checks.map(([name, label, , direction]) => {
                            const raw = (checkin as unknown as Record<string, unknown>)[name];
                            const value =
                              typeof raw === "number" ? raw : Number(raw);
                            return (
                              <ScoreScale
                                defaultValue={Number.isFinite(value) ? value : 3}
                                direction={direction}
                                key={name}
                                label={label}
                                name={name}
                                size="sm"
                              />
                            );
                          })}
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
