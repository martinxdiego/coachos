import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type TeamRelationReader = Pick<
  Prisma.TransactionClient,
  "player" | "training" | "match" | "mondayTraining"
>;

const defaultReader = db as TeamRelationReader;

function unauthorizedRelation(label: string): Error {
  return new Error(`${label} not found or unauthorized.`);
}

export async function requirePlayerInWorkspace(
  workspaceId: string,
  playerId: string,
  reader: TeamRelationReader = defaultReader
): Promise<void> {
  const player = await reader.player.findFirst({
    where: { id: playerId, workspaceId },
    select: { id: true }
  });

  if (!player) {
    throw unauthorizedRelation("Player");
  }
}

export async function requirePlayersInWorkspace(
  workspaceId: string,
  playerIds: readonly string[],
  reader: TeamRelationReader = defaultReader
): Promise<void> {
  const uniquePlayerIds = Array.from(new Set(playerIds));
  if (uniquePlayerIds.length === 0) return;

  const players = await reader.player.findMany({
    where: {
      workspaceId,
      id: { in: uniquePlayerIds }
    },
    select: { id: true }
  });

  if (players.length !== uniquePlayerIds.length) {
    throw unauthorizedRelation("Player");
  }
}

export async function requireTrainingInWorkspace(
  workspaceId: string,
  trainingId: string,
  reader: TeamRelationReader = defaultReader
): Promise<void> {
  const training = await reader.training.findFirst({
    where: { id: trainingId, workspaceId },
    select: { id: true }
  });

  if (!training) {
    throw unauthorizedRelation("Training");
  }
}

export async function requireMatchInWorkspace(
  workspaceId: string,
  matchId: string,
  reader: TeamRelationReader = defaultReader
): Promise<void> {
  const match = await reader.match.findFirst({
    where: { id: matchId, workspaceId },
    select: { id: true }
  });

  if (!match) {
    throw unauthorizedRelation("Match");
  }
}

export async function requireMondayTrainingInWorkspace(
  workspaceId: string,
  mondayTrainingId: string,
  reader: TeamRelationReader = defaultReader
): Promise<void> {
  const training = await reader.mondayTraining.findFirst({
    where: { id: mondayTrainingId, workspaceId },
    select: { id: true }
  });

  if (!training) {
    throw unauthorizedRelation("Monday training");
  }
}

type ContextType =
  | "training"
  | "match"
  | "monday_training"
  | "event"
  | "other";

/**
 * Context ids are polymorphic strings in the current schema. Validate their
 * concrete owner before persisting them so an active team cannot attach a
 * record to another team's training, match, or Monday training.
 */
export async function requireContextInWorkspace(
  workspaceId: string,
  contextType: ContextType,
  contextId: string | null,
  reader: TeamRelationReader = defaultReader
): Promise<void> {
  if (!contextId) return;

  if (contextType === "training") {
    await requireTrainingInWorkspace(workspaceId, contextId, reader);
    return;
  }
  if (contextType === "match") {
    await requireMatchInWorkspace(workspaceId, contextId, reader);
    return;
  }
  if (contextType === "monday_training") {
    await requireMondayTrainingInWorkspace(workspaceId, contextId, reader);
    return;
  }

  // There is no Event table. Preserve the existing ability to label an event
  // with a known team resource, but never accept an arbitrary/cross-team id.
  const [training, match, mondayTraining] = await Promise.all([
    reader.training.findFirst({
      where: { id: contextId, workspaceId },
      select: { id: true }
    }),
    reader.match.findFirst({
      where: { id: contextId, workspaceId },
      select: { id: true }
    }),
    reader.mondayTraining.findFirst({
      where: { id: contextId, workspaceId },
      select: { id: true }
    })
  ]);

  if (!training && !match && !mondayTraining) {
    throw unauthorizedRelation("Context");
  }
}
