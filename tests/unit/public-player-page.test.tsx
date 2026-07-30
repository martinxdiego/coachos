import {
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicSeasonForm: vi.fn(() => null),
  playerFindFirst: vi.fn(),
  workspaceFindUnique: vi.fn(),
  trainingFindMany: vi.fn(),
  matchFindMany: vi.fn(),
  healthCheckFindMany: vi.fn(),
  winnerPointFindMany: vi.fn(),
  ratingFindMany: vi.fn(),
  awardFindMany: vi.fn(),
  coachMessageFindMany: vi.fn(),
  availabilityFindMany: vi.fn(),
  createSignedStorageUrl: vi.fn(),
  getPlayerPortalSession: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  })
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key)
}));

vi.mock("@/components/public-season-form", () => ({
  PublicSeasonForm: mocks.publicSeasonForm
}));

vi.mock("@/components/public-availability-buttons", () => ({
  PublicAvailabilityButtons: vi.fn(() => null)
}));

vi.mock("@/lib/db", () => ({
  db: {
    player: { findFirst: mocks.playerFindFirst },
    workspace: { findUnique: mocks.workspaceFindUnique },
    training: { findMany: mocks.trainingFindMany },
    match: { findMany: mocks.matchFindMany },
    healthCheck: { findMany: mocks.healthCheckFindMany },
    winnerPoint: { findMany: mocks.winnerPointFindMany },
    rating: { findMany: mocks.ratingFindMany },
    award: { findMany: mocks.awardFindMany },
    coachMessage: { findMany: mocks.coachMessageFindMany },
    availabilityResponse: { findMany: mocks.availabilityFindMany }
  }
}));

vi.mock("@/lib/storage", () => ({
  createSignedStorageUrl: mocks.createSignedStorageUrl,
  PLAYER_PHOTO_BUCKET: "player-photos"
}));

vi.mock("@/lib/player-session", () => ({
  getPlayerPortalSession: mocks.getPlayerPortalSession
}));

import PlayerPublicPage from "@/app/player/page";

function findElementByType(
  node: ReactNode,
  type: unknown
): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElementByType(child, type);
      if (match) return match;
    }
    return null;
  }

  if (!isValidElement(node)) return null;
  if (node.type === type) {
    return node as ReactElement<Record<string, unknown>>;
  }

  const props = node.props as { children?: ReactNode };
  return findElementByType(props.children, type);
}

describe("public player page data boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlayerPortalSession.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      playerId: "22222222-2222-4222-8222-222222222222",
      player: {
        id: "22222222-2222-4222-8222-222222222222",
        workspaceId: "33333333-3333-4333-8333-333333333333",
        name: "Test Player"
      }
    });
    mocks.playerFindFirst.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      workspaceId: "33333333-3333-4333-8333-333333333333",
      name: "Test Player",
      firstName: "Test",
      photoUrl: "workspace/player/photo.jpg",
      jerseyNumber: 10,
      position: "Mittelfeld",
      contact: "player@example.com",
      parentContact: "parent@example.com",
      emergencyContact: "emergency@example.com",
      strongFoot: "right",
      favoriteTeam: "FC Test",
      favoritePlayer: "Test Star",
      footballGoals: "Spielübersicht",
      strengths: "Passen",
      weaknesses: "Kopfball",
      motivation: "Team",
      seasonFormCompletedAt: new Date("2026-07-01T12:00:00.000Z"),
      allergies: "must not cross the client boundary",
      injuries: "must not cross the client boundary",
      medications: "must not cross the client boundary",
      medicalNotes: "coach only",
      personalNotes: "coach only"
    });
    mocks.workspaceFindUnique.mockResolvedValue(null);
    mocks.trainingFindMany.mockResolvedValue([]);
    mocks.matchFindMany.mockResolvedValue([]);
    mocks.healthCheckFindMany.mockResolvedValue([]);
    mocks.winnerPointFindMany.mockResolvedValue([]);
    mocks.ratingFindMany.mockResolvedValue([]);
    mocks.awardFindMany.mockResolvedValue([]);
    mocks.coachMessageFindMany.mockResolvedValue([]);
    mocks.availabilityFindMany.mockResolvedValue([]);
    mocks.createSignedStorageUrl.mockResolvedValue(
      "https://storage.example.test/signed-photo"
    );
  });

  it("passes only the explicit non-medical whitelist to PublicSeasonForm", async () => {
    const page = await PlayerPublicPage();
    const form = findElementByType(page, mocks.publicSeasonForm);

    expect(form).not.toBeNull();
    expect(form?.props.player).toEqual({
      contact: "player@example.com",
      parent_contact: "parent@example.com",
      emergency_contact: "emergency@example.com",
      strong_foot: "right",
      favorite_team: "FC Test",
      favorite_player: "Test Star",
      football_goals: "Spielübersicht",
      strengths: "Passen",
      weaknesses: "Kopfball",
      motivation: "Team",
      season_form_completed_at: "2026-07-01T12:00:00.000Z"
    });
    expect(mocks.createSignedStorageUrl).toHaveBeenCalledWith(
      "player-photos",
      "workspace/player/photo.jpg",
      "33333333-3333-4333-8333-333333333333/"
    );

    const query = mocks.playerFindFirst.mock.calls[0]?.[0];
    expect(query.select).not.toHaveProperty("allergies");
    expect(query.select).not.toHaveProperty("injuries");
    expect(query.select).not.toHaveProperty("limitations");
    expect(query.select).not.toHaveProperty("medications");
    expect(query.select).not.toHaveProperty("medicalNotes");
    expect(query.select).not.toHaveProperty("coachAlerts");
    expect(query.select).not.toHaveProperty("personalNotes");
    expect(query.select).not.toHaveProperty("trainingNotes");
  });
});
