import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveTeam: vi.fn(),
  playerFindMany: vi.fn(),
  healthCheckFindMany: vi.fn(),
  trainingFindMany: vi.fn(),
  matchFindFirst: vi.fn(),
  trainingCreate: vi.fn(),
  trainingPhaseCreateMany: vi.fn(),
  generateTrainingPlan: vi.fn(),
  revalidatePath: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireActiveTeam: mocks.requireActiveTeam,
}));

vi.mock("@/lib/db", () => ({
  db: {
    player: {
      findMany: mocks.playerFindMany,
    },
    healthCheck: {
      findMany: mocks.healthCheckFindMany,
    },
    training: {
      findMany: mocks.trainingFindMany,
      create: mocks.trainingCreate,
    },
    match: {
      findFirst: mocks.matchFindFirst,
    },
    trainingPhase: {
      createMany: mocks.trainingPhaseCreateMany,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    generateTrainingPlan: mocks.generateTrainingPlan,
  };
});

import { createAiTrainingDraft } from "@/app/actions/ai";
import {
  aggregateTeamLoadSignals,
  buildTrainingPlanPrompt,
  normalizeAiAgeGroup,
  normalizeAiTrainingFocus,
  parseTrainingPlanResponse,
  summarizeRecentTrainingIntensity,
  type GenerateTrainingPlanParams,
} from "@/lib/ai";

const previousApiKey = process.env.ANTHROPIC_API_KEY;

const safePromptParams: GenerateTrainingPlanParams = {
  ageGroup: "U16 FC Personenbezug",
  durationMinutes: 90,
  focusCategory: "Max Müller soll beim Torabschluss geschont werden",
  daysUntilNextMatch: 3,
  totalPlayers: 18,
  availableCount: 13,
  limitedCount: 2,
  injuredCount: 1,
  absentCount: 2,
  checkinCoverageCount: 12,
  wellnessGreenCount: 8,
  wellnessYellowCount: 3,
  wellnessRedCount: 1,
  recentTrainingCount: 4,
  recentLowIntensityCount: 1,
  recentMediumIntensityCount: 2,
  recentHighIntensityCount: 1,
  recentUnknownIntensityCount: 0,
};

describe("AI privacy boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mocks.rateLimit.mockResolvedValue({
      success: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 60_000
    });

    mocks.requireActiveTeam.mockResolvedValue({
      user: { id: "user-sensitive-id" },
      team: {
        id: "workspace-sensitive-id",
        name: "FC Personenbezug",
        ageGroup: "U16 FC Personenbezug",
      },
    });
    mocks.playerFindMany.mockResolvedValue([
      { id: "player-max-id", name: "Max Müller", status: "AVAILABLE" },
      { id: "player-lena-id", name: "Lena Meier", status: "LIMITED" },
    ]);
    mocks.healthCheckFindMany.mockResolvedValue([
      {
        playerId: "player-max-id",
        fatigue: 1,
        sleepQuality: 4,
        soreness: 1,
        pain: 1,
        stress: 1,
        motivation: 4,
        energy: 4,
        injuryFeeling: 1,
        wellbeing: 4,
        notes: "Max hat private Beschwerden",
      },
      {
        playerId: "player-lena-id",
        fatigue: 4,
        sleepQuality: 2,
        soreness: 4,
        pain: 4,
        stress: 4,
        motivation: 2,
        energy: 2,
        injuryFeeling: 4,
        wellbeing: 2,
        notes: "Lena hat private Beschwerden",
      },
    ]);
    mocks.trainingFindMany.mockResolvedValue([
      { intensity: "low", focus: "Max individuell fördern" },
      { intensity: "high", focus: "Lena individuell fördern" },
    ]);
    mocks.matchFindFirst.mockResolvedValue({
      date: new Date("2030-01-13T00:00:00.000Z"),
      opponent: "FC Gegnername",
      kickoffTime: "18:00",
    });
    mocks.generateTrainingPlan.mockResolvedValue({
      focus: "Anonymisierter Trainingsentwurf",
      goal: "Kontrolliertes Gruppenziel",
      intensity: "medium",
      notes: "Belastung gruppenweit skalieren.",
      phases: [],
    });
    mocks.trainingCreate.mockResolvedValue({ id: "training-id" });
  });

  afterAll(() => {
    if (previousApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousApiKey;
  });

  it("turns arbitrary focus and age text into controlled categories", () => {
    expect(normalizeAiTrainingFocus("Max Müller soll beim Torabschluss geschont werden")).toBe(
      "Torabschluss",
    );
    expect(normalizeAiTrainingFocus("Lena braucht heute eine Sonderbehandlung")).toBe(
      "Allgemeine fußballspezifische Entwicklung",
    );
    expect(normalizeAiAgeGroup("U16 FC Personenbezug")).toBe("U16");
    expect(normalizeAiAgeGroup("FC Personenbezug")).toBeNull();
  });

  it("builds the prompt from aggregates without identifiable free text", () => {
    const prompt = buildTrainingPlanPrompt(safePromptParams);

    expect(prompt).toContain("Altersstufe: U16");
    expect(prompt).toContain("Kontrollierter Schwerpunkt: Torabschluss");
    expect(prompt).toContain("Team-Ampel: 8 grün, 3 gelb, 1 rot");
    expect(prompt).toContain("Nächstes Spiel in 3 Tag(en)");
    expect(prompt).not.toContain("Max Müller");
    expect(prompt).not.toContain("FC Personenbezug");
    expect(prompt).not.toContain("namentlich");
    expect(prompt).toContain("Gib keine Diagnosen oder medizinischen Empfehlungen");
  });

  it("aggregates local player and wellness inputs without returning IDs or names", () => {
    const playerRowsWithPrivateFields = [
      { id: "player-max-id", name: "Max Müller", status: "AVAILABLE" as const },
      { id: "player-lena-id", name: "Lena Meier", status: "LIMITED" as const },
      { id: "player-red-id", name: "Robin Roth", status: "INJURED" as const },
      { id: "player-absent-id", name: "Alex Frei", status: "ABSENT" as const },
    ];
    const summary = aggregateTeamLoadSignals(
      playerRowsWithPrivateFields,
      [
        {
          playerId: "player-max-id",
          fatigue: 1,
          sleepQuality: 4,
          soreness: 1,
          pain: 1,
          stress: 1,
          motivation: 4,
          energy: 4,
          injuryFeeling: 1,
          wellbeing: 4,
        },
        {
          playerId: "player-lena-id",
          fatigue: 3,
          sleepQuality: 2,
          soreness: 2,
          pain: 1,
          stress: 3,
          motivation: 3,
          energy: 3,
          injuryFeeling: 1,
          wellbeing: 3,
        },
        {
          playerId: "player-red-id",
          fatigue: 4,
          sleepQuality: 2,
          soreness: 4,
          pain: 4,
          stress: 4,
          motivation: 2,
          energy: 2,
          injuryFeeling: 4,
          wellbeing: 2,
        },
        {
          // Older duplicate: newest-first semantics must keep the first signal.
          playerId: "player-max-id",
          fatigue: 5,
          sleepQuality: 1,
          soreness: 5,
          pain: 5,
          stress: 5,
          motivation: 1,
          energy: 1,
          injuryFeeling: 5,
          wellbeing: 1,
        },
      ],
    );

    expect(summary).toEqual({
      totalPlayers: 4,
      availableCount: 1,
      limitedCount: 1,
      injuredCount: 1,
      absentCount: 1,
      checkinCoverageCount: 3,
      wellnessGreenCount: 1,
      wellnessYellowCount: 1,
      wellnessRedCount: 1,
    });
    expect(JSON.stringify(summary)).not.toMatch(/Max|Lena|Robin|player-/);
  });

  it("summarizes recent workload without training focus text", () => {
    const trainingRowsWithPrivateFields = [
      { intensity: "low", focus: "Max Müller" },
      { intensity: "medium", focus: "Lena Meier" },
      { intensity: "high", focus: "FC Gegnername" },
      { intensity: null, focus: "private Notiz" },
    ];
    const summary = summarizeRecentTrainingIntensity(trainingRowsWithPrivateFields);

    expect(summary).toEqual({
      recentTrainingCount: 4,
      recentLowIntensityCount: 1,
      recentMediumIntensityCount: 1,
      recentHighIntensityCount: 1,
      recentUnknownIntensityCount: 1,
    });
    expect(JSON.stringify(summary)).not.toMatch(/Max|Lena|Gegner|Notiz/);
  });

  it("does not log a raw invalid model response", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rawResponse = "Max Müller: vertrauliche Rohdaten; kein JSON";

    expect(() => parseTrainingPlanResponse(rawResponse)).toThrow(
      "Die KI hat ein ungültiges Format zurückgegeben.",
    );
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0]))).toMatchObject({
      level: "error",
      message: "AI model returned invalid JSON",
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(rawResponse);

    errorSpy.mockRestore();
  });

  it("queries only required columns and sends only aggregate values to Anthropic", async () => {
    const formData = new FormData();
    formData.set("focus", "Max Müller soll Torabschluss trainieren");
    formData.set("duration_minutes", "90");
    formData.set("age_group", "U16 FC Personenbezug");
    formData.set("date", "2030-01-10");
    formData.set("context", "Lena Meier hat vertrauliche Beschwerden");

    await createAiTrainingDraft(formData);

    expect(mocks.playerFindMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-sensitive-id" },
      select: {
        id: true,
        status: true,
      },
    });
    expect(mocks.healthCheckFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          playerId: true,
          fatigue: true,
          sleepQuality: true,
          soreness: true,
          pain: true,
          stress: true,
          motivation: true,
          energy: true,
          injuryFeeling: true,
          wellbeing: true,
        },
      }),
    );
    expect(mocks.trainingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { intensity: true },
      }),
    );
    expect(mocks.matchFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { date: true },
      }),
    );

    const payload = mocks.generateTrainingPlan.mock.calls[0]?.[0];
    expect(Object.keys(payload).sort()).toEqual(
      [
        "absentCount",
        "ageGroup",
        "availableCount",
        "checkinCoverageCount",
        "daysUntilNextMatch",
        "durationMinutes",
        "focusCategory",
        "injuredCount",
        "limitedCount",
        "recentHighIntensityCount",
        "recentLowIntensityCount",
        "recentMediumIntensityCount",
        "recentTrainingCount",
        "recentUnknownIntensityCount",
        "totalPlayers",
        "wellnessGreenCount",
        "wellnessRedCount",
        "wellnessYellowCount",
      ].sort(),
    );
    expect(payload).toMatchObject({
      ageGroup: "U16",
      focusCategory: "Torabschluss",
      daysUntilNextMatch: 3,
      totalPlayers: 2,
      availableCount: 1,
      limitedCount: 1,
      checkinCoverageCount: 2,
      wellnessGreenCount: 1,
      wellnessRedCount: 1,
      recentTrainingCount: 2,
      recentLowIntensityCount: 1,
      recentHighIntensityCount: 1,
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /Max|Müller|Lena|Meier|FC Personenbezug|FC Gegnername|player-|workspace-|vertraulich/,
    );
  });

  it("blocks AI cost before querying team data when a daily quota is exhausted", async () => {
    mocks.rateLimit
      .mockResolvedValueOnce({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60_000
      })
      .mockResolvedValueOnce({
        success: true,
        limit: 20,
        remaining: 10,
        reset: Date.now() + 60_000
      });
    const formData = new FormData();
    formData.set("focus", "Torabschluss");
    formData.set("duration_minutes", "90");
    formData.set("date", "2030-01-10");

    await expect(createAiTrainingDraft(formData)).rejects.toThrow(
      "tägliche KI-Kontingent"
    );
    expect(mocks.playerFindMany).not.toHaveBeenCalled();
    expect(mocks.generateTrainingPlan).not.toHaveBeenCalled();
  });
});
