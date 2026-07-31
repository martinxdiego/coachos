import { describe, expect, it, vi } from "vitest";
import {
  requireContextInWorkspace,
  requireMatchInWorkspace,
  requireMondayTrainingInWorkspace,
  requirePlayerInWorkspace,
  requirePlayersInWorkspace,
  requireTrainingInWorkspace,
  type TeamRelationReader
} from "./team-relations";

const WORKSPACE_ID = "team-a";

function createReader({
  playerIds = [],
  trainingIds = [],
  matchIds = [],
  mondayTrainingIds = []
}: {
  playerIds?: string[];
  trainingIds?: string[];
  matchIds?: string[];
  mondayTrainingIds?: string[];
} = {}): TeamRelationReader {
  const players = new Set(playerIds);
  const trainings = new Set(trainingIds);
  const matches = new Set(matchIds);
  const mondayTrainings = new Set(mondayTrainingIds);

  return {
    player: {
      findFirst: vi.fn(async ({ where }) =>
        where.workspaceId === WORKSPACE_ID && players.has(String(where.id))
          ? { id: String(where.id) }
          : null
      ),
      findMany: vi.fn(async ({ where }) => {
        const ids: readonly unknown[] =
          where.id && typeof where.id === "object" && "in" in where.id
            ? (where.id.in ?? [])
            : [];
        return ids
          .map(String)
          .filter(
            (id) => where.workspaceId === WORKSPACE_ID && players.has(id)
          )
          .map((id) => ({ id }));
      })
    },
    training: {
      findFirst: vi.fn(async ({ where }) =>
        where.workspaceId === WORKSPACE_ID && trainings.has(String(where.id))
          ? { id: String(where.id) }
          : null
      )
    },
    match: {
      findFirst: vi.fn(async ({ where }) =>
        where.workspaceId === WORKSPACE_ID && matches.has(String(where.id))
          ? { id: String(where.id) }
          : null
      )
    },
    mondayTraining: {
      findFirst: vi.fn(async ({ where }) =>
        where.workspaceId === WORKSPACE_ID &&
        mondayTrainings.has(String(where.id))
          ? { id: String(where.id) }
          : null
      )
    }
  } as unknown as TeamRelationReader;
}

describe("team relation guards", () => {
  it("rejects a player id owned by another workspace", async () => {
    const reader = createReader({ playerIds: ["team-a-player"] });

    await expect(
      requirePlayerInWorkspace(WORKSPACE_ID, "team-b-player", reader)
    ).rejects.toThrow("Player not found or unauthorized.");
  });

  it("rejects the complete attendance batch if one player is cross-tenant", async () => {
    const reader = createReader({ playerIds: ["team-a-player"] });

    await expect(
      requirePlayersInWorkspace(
        WORKSPACE_ID,
        ["team-a-player", "team-b-player"],
        reader
      )
    ).rejects.toThrow("Player not found or unauthorized.");
  });

  it("rejects cross-tenant training and Monday attendance parents", async () => {
    const reader = createReader({
      trainingIds: ["team-a-training"],
      mondayTrainingIds: ["team-a-monday"]
    });

    await expect(
      requireTrainingInWorkspace(WORKSPACE_ID, "team-b-training", reader)
    ).rejects.toThrow("Training not found or unauthorized.");
    await expect(
      requireMondayTrainingInWorkspace(WORKSPACE_ID, "team-b-monday", reader)
    ).rejects.toThrow("Monday training not found or unauthorized.");
  });

  it("rejects a cross-tenant award match", async () => {
    const reader = createReader({ matchIds: ["team-a-match"] });

    await expect(
      requireMatchInWorkspace(WORKSPACE_ID, "team-b-match", reader)
    ).rejects.toThrow("Match not found or unauthorized.");
  });

  it("validates polymorphic evaluation and winner context ids by type", async () => {
    const reader = createReader({
      trainingIds: ["team-a-training"],
      matchIds: ["team-a-match"]
    });

    await expect(
      requireContextInWorkspace(
        WORKSPACE_ID,
        "match",
        "team-a-training",
        reader
      )
    ).rejects.toThrow("Match not found or unauthorized.");
    await expect(
      requireContextInWorkspace(
        WORKSPACE_ID,
        "match",
        "team-a-match",
        reader
      )
    ).resolves.toBeUndefined();
  });
});
