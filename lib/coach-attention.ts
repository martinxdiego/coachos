import "server-only";

import { db } from "@/lib/db";
import { healthRisk } from "@/lib/coach-metrics";
import { todayIsoDate } from "@/lib/utils";

export type AttentionTone = "urgent" | "warning" | "info" | "success";

export interface CoachAttentionItem {
  id: string;
  title: string;
  body: string;
  href: string;
  label: string;
  tone: AttentionTone;
  createdAt: Date;
}

export async function getCoachAttentionItems(workspaceId: string) {
  const now = new Date();
  const recent = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const today = new Date(`${todayIsoDate(now)}T00:00:00.000Z`);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [players, healthChecks, feedback, tasks, nextTraining, nextMatch] =
    await Promise.all([
      db.player.count({ where: { workspaceId } }),
      db.healthCheck.findMany({
        where: {
          createdAt: { gte: recent },
          player: { workspaceId }
        },
        include: { player: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 24
      }),
      db.playerFeedback.findMany({
        where: { workspaceId, createdAt: { gte: recent } },
        include: { player: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8
      }),
      db.task.findMany({
        where: {
          workspaceId,
          status: "open",
          OR: [{ dueDate: null }, { dueDate: { lte: nextWeek } }]
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 6
      }),
      db.training.findFirst({
        where: { workspaceId, date: { gte: today } },
        orderBy: { date: "asc" },
        select: { id: true, focus: true, date: true, startTime: true }
      }),
      db.match.findFirst({
        where: { workspaceId, date: { gte: today } },
        orderBy: { date: "asc" },
        select: { id: true, opponent: true, date: true, kickoffTime: true }
      })
    ]);

  const availabilityQueries = [
    nextTraining
      ? db.availabilityResponse.count({
          where: {
            workspaceId,
            eventType: "TRAINING",
            eventId: nextTraining.id
          }
        })
      : Promise.resolve(0),
    nextMatch
      ? db.availabilityResponse.count({
          where: {
            workspaceId,
            eventType: "MATCH",
            eventId: nextMatch.id
          }
        })
      : Promise.resolve(0)
  ];
  const [trainingResponses, matchResponses] = await Promise.all(availabilityQueries);

  const items: CoachAttentionItem[] = [];
  const seenHealthPlayers = new Set<string>();
  for (const checkin of healthChecks) {
    if (seenHealthPlayers.has(checkin.playerId)) continue;
    seenHealthPlayers.add(checkin.playerId);
    const risk = healthRisk({
      fatigue: checkin.fatigue,
      sleep_quality: checkin.sleepQuality ?? 3,
      soreness: checkin.soreness,
      pain: checkin.pain,
      stress: checkin.stress,
      motivation: checkin.motivation,
      energy: checkin.energy ?? 3,
      injury_feeling: checkin.injuryFeeling ?? 1,
      wellbeing: checkin.wellbeing ?? 3
    });
    if (risk === "green") continue;
    items.push({
      id: `health-${checkin.playerId}`,
      title: `${checkin.player.name}: Belastung prüfen`,
      body:
        risk === "red"
          ? "Der aktuelle Check-in enthält ein kritisches Belastungssignal."
          : "Der aktuelle Check-in enthält ein auffälliges Belastungssignal.",
      href: `/players/${checkin.player.id}`,
      label: "Gesundheit",
      tone: risk === "red" ? "urgent" : "warning",
      createdAt: checkin.createdAt
    });
  }

  for (const entry of feedback) {
    items.push({
      id: `feedback-${entry.id}`,
      title: `Neue Rückmeldung von ${entry.player.name}`,
      body: entry.notes
        ? `Stimmung ${entry.rating}/10 · persönliche Nachricht vorhanden`
        : `Stimmung ${entry.rating}/10`,
      href: `/players/${entry.player.id}`,
      label: "Spieler",
      tone: entry.rating <= 4 ? "warning" : "info",
      createdAt: entry.createdAt
    });
  }

  for (const task of tasks) {
    const overdue = Boolean(task.dueDate && task.dueDate.getTime() < now.getTime());
    items.push({
      id: `task-${task.id}`,
      title: task.title,
      body: overdue ? "Diese Aufgabe ist überfällig." : "Offene Aufgabe für die nächsten Tage.",
      href: "/",
      label: "Aufgabe",
      tone: overdue ? "warning" : "info",
      createdAt: task.createdAt
    });
  }

  const addAvailabilityItem = (
    event: typeof nextTraining | typeof nextMatch,
    responses: number,
    type: "Training" | "Spiel"
  ) => {
    if (!event || players === 0) return;
    const missing = Math.max(0, players - responses);
    if (missing === 0) return;
    items.push({
      id: `availability-${type.toLowerCase()}-${event.id}`,
      title: `${missing} Rückmeldung${missing === 1 ? "" : "en"} fehlen`,
      body: `${type}: ${"focus" in event ? event.focus : `vs. ${event.opponent}`}`,
      href: "/availability",
      label: "Zu- & Absagen",
      tone: "info",
      createdAt: event.date
    });
  };

  addAvailabilityItem(nextTraining, trainingResponses, "Training");
  addAvailabilityItem(nextMatch, matchResponses, "Spiel");

  const toneOrder: Record<AttentionTone, number> = {
    urgent: 0,
    warning: 1,
    info: 2,
    success: 3
  };
  return items
    .sort(
      (a, b) =>
        toneOrder[a.tone] - toneOrder[b.tone] ||
        b.createdAt.getTime() - a.createdAt.getTime()
    )
    .slice(0, 20);
}

export async function getCoachAttentionCount(workspaceId: string) {
  return (await getCoachAttentionItems(workspaceId)).length;
}
