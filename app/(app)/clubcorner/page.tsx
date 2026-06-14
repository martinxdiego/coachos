import Link from "next/link";
import {
  ExternalLink as ExternalLinkIcon,
  FileText,
  Link2,
  Save,
  Trash2
} from "lucide-react";
import {
  createExternalLink,
  deleteExternalLink,
  updateExternalLink
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { getTranslations } from "next-intl/server";
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
import { evaluationAverage, winnerPointTotal } from "@/lib/coach-metrics";
import { requireActiveTeam } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import type { ExternalLinkType, EvaluationContextType } from "@/lib/types";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const linkLabels: Record<ExternalLinkType, string> = {
  clubcorner: "Clubcorner",
  medical: "Medizin",
  meeting_notes: "Gesprächsnotiz",
  other: "Sonstiges",
  player_stats: "Spielerstatistik",
  quali_document: "Quali-Dokument"
};

export default async function ClubcornerPage() {
  const { team } = await requireActiveTeam();
  const t = await getTranslations("pages");

  const [
    dbPlayers,
    dbLinks,
    dbAttendance,
    dbFeedback,
    dbRatings,
    dbWinnerPoints
  ] = await Promise.all([
    db.player.findMany({
      where: { workspaceId: team.id },
      select: {
        id: true,
        name: true,
        position: true,
        developmentGoals: true,
        trainingNotes: true,
        personalNotes: true,
        notes: true
      },
      orderBy: { lastName: "asc" }
    }),
    db.externalLink.findMany({
      where: { workspaceId: team.id },
      orderBy: { createdAt: "desc" }
    }),
    db.attendance.findMany({
      where: {
        player: {
          workspaceId: team.id
        }
      },
      select: {
        playerId: true,
        status: true
      }
    }),
    db.playerFeedback.findMany({
      where: { workspaceId: team.id },
      select: {
        playerId: true,
        rating: true
      }
    }),
    db.rating.findMany({
      where: {
        player: {
          workspaceId: team.id
        }
      },
      orderBy: { date: "desc" },
      take: 500
    }),
    db.winnerPoint.findMany({
      where: { workspaceId: team.id },
      select: {
        playerId: true,
        points: true
      }
    })
  ]);

  const players = dbPlayers.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    team_category: null,
    development_goals: p.developmentGoals,
    training_notes: p.trainingNotes,
    personal_notes: p.personalNotes,
    notes: p.notes
  }));

  const links = dbLinks.map(l => ({
    id: l.id,
    player_id: l.playerId,
    link_type: l.linkType as ExternalLinkType,
    title: l.title,
    url: l.url,
    notes: l.notes,
    created_at: l.createdAt.toISOString()
  }));

  const attendance = dbAttendance.map(a => ({
    player_id: a.playerId,
    status: a.status
  }));

  const feedback = dbFeedback.map(f => ({
    player_id: f.playerId,
    rating: f.rating
  }));

  const evaluations = dbRatings.map((e) => ({
    id: e.id,
    player_id: e.playerId,
    user_id: e.raterId,
    context_type: e.contextType as EvaluationContextType,
    context_id: e.contextId,
    context_label: e.contextLabel,
    evaluation_date: e.date.toISOString().slice(0, 10),
    participation: e.participation,
    motivation: e.motivation,
    training_quality: e.trainingQuality,
    match_quality: e.matchQuality,
    behavior: e.behavior,
    effort: e.effort,
    concentration: e.concentration,
    average: e.average,
    notes: e.notes ?? e.comment,
    created_at: e.createdAt.toISOString()
  }));

  const points = dbWinnerPoints.map(wp => ({
    player_id: wp.playerId,
    points: wp.points
  }));

  const globalLinks = links.filter((link) => !link.player_id);
  const playerById = new Map(players.map((player) => [player.id, player]));

  const summaries = players.map((player) => {
    const attendanceForPlayer = attendance.filter(
      (row) => row.player_id === player.id
    );
    const present = attendanceForPlayer.filter(
      (row) => row.status === "present"
    ).length;
    const feedbackForPlayer = feedback.filter(
      (item) => item.player_id === player.id
    );
    const evaluationsForPlayer = evaluations.filter(
      (item) => item.player_id === player.id
    );
    const evalAverages = evaluationsForPlayer
      .map(evaluationAverage)
      .filter((value): value is number => value !== null);
    const avgFeedback =
      feedbackForPlayer.length > 0
        ? feedbackForPlayer.reduce((sum, item) => sum + item.rating, 0) /
          feedbackForPlayer.length
        : null;
    const avgEvaluation =
      evalAverages.length > 0
        ? evalAverages.reduce((sum, value) => sum + value, 0) /
          evalAverages.length
        : null;

    return {
      player,
      appearances: evaluationsForPlayer.filter(
        (evaluation) => evaluation.context_type === "match"
      ).length,
      attendanceRate:
        attendanceForPlayer.length > 0
          ? Math.round((present / attendanceForPlayer.length) * 100)
          : null,
      avgFeedback,
      avgEvaluation,
      winnerPoints: winnerPointTotal(
        points.filter((point) => point.player_id === player.id)
      ),
      links: links.filter((link) => link.player_id === player.id)
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("clubcorner_desc")}
        title={t("clubcorner_title")}
      />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="h-fit border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle>Externen Link speichern</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createExternalLink} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="link-title">Titel</Label>
                  <Input
                    id="link-title"
                    name="title"
                    placeholder="Clubcorner Teamseite"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-type">Typ</Label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="link-type"
                    name="link_type"
                    required
                  >
                    {Object.entries(linkLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL oder Dokumenthinweis</Label>
                <Input
                  id="link-url"
                  name="url"
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-player">Spielerbezug optional</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  id="link-player"
                  name="player_id"
                >
                  <option value="">Team / Staff allgemein</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea name="notes" placeholder="Notiz fuer Quali-Gespräch" />
              <Button className="w-full" type="submit">
                <Link2 aria-hidden="true" className="h-4 w-4" />
                Link speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team-Links</CardTitle>
          </CardHeader>
          <CardContent>
            {globalLinks.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {globalLinks.map((link) => (
                  <div
                    className="rounded-xl border border-border bg-background/70 p-4"
                    key={link.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge variant="secondary">
                          {linkLabels[link.link_type]}
                        </Badge>
                        <p className="mt-2 font-semibold">{link.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(link.created_at)}
                        </p>
                      </div>
                      <Button asChild size="icon" variant="ghost">
                        <a href={link.url} rel="noreferrer" target="_blank">
                          <ExternalLinkIcon
                            aria-hidden="true"
                            className="h-4 w-4"
                          />
                        </a>
                      </Button>
                    </div>
                    {link.notes ? (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {link.notes}
                      </p>
                    ) : null}
                    <form action={deleteExternalLink} className="mt-3">
                      <input name="id" type="hidden" value={link.id} />
                      <Button size="sm" type="submit" variant="ghost">
                        Entfernen
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Noch keine Team-Links gespeichert." />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Linkverwaltung</CardTitle>
        </CardHeader>
        <CardContent>
          {links.length > 0 ? (
            <div className="grid gap-3">
              {links.map((link) => {
                const player = link.player_id
                  ? playerById.get(link.player_id)
                  : null;

                return (
                  <details
                    className="rounded-xl border border-border bg-background/70 p-4"
                    key={link.id}
                  >
                    <summary className="cursor-pointer">
                      <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="font-semibold">{link.title}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {linkLabels[link.link_type]}
                            {player ? ` · ${player.name}` : " · Team"}
                          </span>
                        </span>
                        <Badge variant="secondary">
                          {formatDateTime(link.created_at)}
                        </Badge>
                      </span>
                    </summary>
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_auto]">
                      <form action={updateExternalLink} className="space-y-4">
                        <input name="id" type="hidden" value={link.id} />
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Titel</Label>
                            <Input
                              defaultValue={link.title}
                              name="title"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Typ</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={link.link_type}
                              name="link_type"
                            >
                              {Object.entries(linkLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div className="space-y-2 lg:col-span-2">
                            <Label>Spielerbezug</Label>
                            <select
                              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              defaultValue={link.player_id ?? ""}
                              name="player_id"
                            >
                              <option value="">Team / Staff allgemein</option>
                              {players.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Input defaultValue={link.url} name="url" required />
                        <Textarea
                          defaultValue={link.notes ?? ""}
                          name="notes"
                          placeholder="Notiz"
                        />
                        <Button type="submit">
                          <Save aria-hidden="true" className="h-4 w-4" />
                          Link speichern
                        </Button>
                      </form>
                      <form action={deleteExternalLink}>
                        <input name="id" type="hidden" value={link.id} />
                        <input
                          name="player_id"
                          type="hidden"
                          value={link.player_id ?? ""}
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
            <EmptyState title="Noch keine Links zum Bearbeiten." />
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Quali-Gesprächsübersicht</h2>
        </div>

        {summaries.length > 0 ? (
          <div className="grid gap-4">
            {summaries.map((summary) => (
              <Card key={summary.player.id}>
                <CardContent className="grid gap-4 p-5 xl:grid-cols-[1fr_1.6fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {summary.player.name}
                      </h3>
                      {summary.player.team_category ? (
                        <Badge variant="secondary">
                          {summary.player.team_category}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {summary.player.position ?? "Position offen"}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-secondary px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Einsätze
                        </p>
                        <p className="font-semibold">{summary.appearances}</p>
                      </div>
                      <div className="rounded-lg bg-secondary px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Training
                        </p>
                        <p className="font-semibold">
                          {summary.attendanceRate !== null
                            ? `${summary.attendanceRate}%`
                            : "Offen"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Bewertung
                        </p>
                        <p className="font-semibold">
                          {summary.avgEvaluation !== null
                            ? `${summary.avgEvaluation.toFixed(1)}/5`
                            : summary.avgFeedback !== null
                              ? `${summary.avgFeedback.toFixed(1)}/10`
                              : "Offen"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Winnerpunkte
                        </p>
                        <p className="font-semibold">{summary.winnerPoints}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-border bg-background/70 p-4">
                      <p className="text-sm font-semibold">Ziele und Notizen</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {summary.player.development_goals ||
                          summary.player.training_notes ||
                          summary.player.personal_notes ||
                          summary.player.notes ||
                          "Noch keine Gesprächsnotizen hinterlegt."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {summary.links.length > 0 ? (
                        summary.links.map((link) => (
                          <Button
                            asChild
                            key={link.id}
                            size="sm"
                            variant="outline"
                          >
                            <a href={link.url} rel="noreferrer" target="_blank">
                              {link.title}
                              <ExternalLinkIcon
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                              />
                            </a>
                          </Button>
                        ))
                      ) : (
                        <Badge variant="outline">Keine Spieler-Links</Badge>
                      )}
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/players/${summary.player.id}`}>
                          Portfolio öffnen
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Noch keine Spieler fuer Quali-Gespräche." />
        )}
      </section>
    </div>
  );
}
