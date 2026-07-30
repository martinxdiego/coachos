import "server-only";

import { db } from "@/lib/db";

export const WORKSPACE_EXPORT_VERSION = 1;

/**
 * Builds a portable workspace archive without authentication credentials,
 * bearer tokens, invite codes, or push-subscription secrets.
 */
export async function buildWorkspaceExport(workspaceId: string) {
  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        season: true,
        ageGroup: true,
        pointsLabel: true,
        awardsLabel: true,
        linksLabel: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const members = await tx.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: { id: "asc" }
    });
    const players = await tx.player.findMany({
      where: { workspaceId },
      omit: { accessToken: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }]
    });
    const trainings = await tx.training.findMany({
      where: { workspaceId },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    const trainingPhases = await tx.trainingPhase.findMany({
      where: { training: { workspaceId } },
      orderBy: [{ trainingId: "asc" }, { sortOrder: "asc" }]
    });
    const attendance = await tx.attendance.findMany({
      where: { training: { workspaceId } },
      orderBy: [{ trainingId: "asc" }, { playerId: "asc" }]
    });
    const matches = await tx.match.findMany({
      where: { workspaceId },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    const matchAnalyses = await tx.matchAnalysis.findMany({
      where: { match: { workspaceId } },
      orderBy: { matchId: "asc" }
    });
    const matchEvents = await tx.matchEvent.findMany({
      where: { match: { workspaceId } },
      orderBy: [{ matchId: "asc" }, { minute: "asc" }, { createdAt: "asc" }]
    });
    const matchLineups = await tx.matchLineup.findMany({
      where: { match: { workspaceId } },
      orderBy: [{ matchId: "asc" }, { id: "asc" }]
    });
    const ratings = await tx.rating.findMany({
      where: { player: { workspaceId } },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    const healthChecks = await tx.healthCheck.findMany({
      where: { player: { workspaceId } },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    const awards = await tx.award.findMany({
      where: { workspaceId },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    const winnerPoints = await tx.winnerPoint.findMany({
      where: { workspaceId },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    const materials = await tx.material.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const tacticBoards = await tx.tacticBoard.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const tasks = await tx.task.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const notes = await tx.note.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const externalLinks = await tx.externalLink.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const mondayTrainings = await tx.mondayTraining.findMany({
      where: { workspaceId },
      orderBy: [{ date: "asc" }, { id: "asc" }]
    });
    const mondayAttendance = await tx.mondayAttendance.findMany({
      where: { mondayTraining: { workspaceId } },
      orderBy: [{ mondayTrainingId: "asc" }, { playerId: "asc" }]
    });
    const coachMessages = await tx.coachMessage.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const playerFeedback = await tx.playerFeedback.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const invites = await tx.teamInvite.findMany({
      where: { workspaceId },
      select: {
        id: true,
        role: true,
        createdBy: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    });
    const auditLogs = await tx.auditLog.findMany({
      where: { workspaceId },
      select: {
        id: true,
        event: true,
        actorUserId: true,
        actorPlayerId: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    });
    const availabilityResponses = await tx.availabilityResponse.findMany({
      where: { workspaceId },
      orderBy: [{ eventType: "asc" }, { eventId: "asc" }, { playerId: "asc" }]
    });

    return {
      metadata: {
        product: "CoachOS",
        exportVersion: WORKSPACE_EXPORT_VERSION,
        generatedAt: new Date().toISOString(),
        excludedSecrets: [
          "password hashes",
          "player access tokens",
          "invite codes",
          "push subscription credentials"
        ]
      },
      workspace,
      members,
      players,
      trainings,
      trainingPhases,
      attendance,
      matches,
      matchAnalyses,
      matchEvents,
      matchLineups,
      ratings,
      healthChecks,
      awards,
      winnerPoints,
      materials,
      tacticBoards,
      tasks,
      notes,
      externalLinks,
      mondayTrainings,
      mondayAttendance,
      coachMessages,
      playerFeedback,
      invites,
      auditLogs,
      availabilityResponses
    };
  }, { timeout: 30_000 });
}
