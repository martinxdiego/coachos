import Anthropic from "@anthropic-ai/sdk";
import { healthRisk } from "@/lib/coach-metrics";
import { logger } from "@/lib/logger";

export type AiPlayerStatus = "AVAILABLE" | "LIMITED" | "INJURED" | "ABSENT";

export interface AiPlayerSignal {
  id: string;
  status: AiPlayerStatus;
}

export interface AiCheckinSignal {
  playerId: string;
  fatigue: number;
  sleepQuality: number | null;
  soreness: number;
  pain: number;
  stress: number;
  motivation: number;
  energy: number | null;
  injuryFeeling: number | null;
  wellbeing: number | null;
}

export interface TeamLoadSummary {
  totalPlayers: number;
  availableCount: number;
  limitedCount: number;
  injuredCount: number;
  absentCount: number;
  checkinCoverageCount: number;
  wellnessGreenCount: number;
  wellnessYellowCount: number;
  wellnessRedCount: number;
}

export interface RecentTrainingSummary {
  recentTrainingCount: number;
  recentLowIntensityCount: number;
  recentMediumIntensityCount: number;
  recentHighIntensityCount: number;
  recentUnknownIntensityCount: number;
}

export interface GenerateTrainingPlanParams extends TeamLoadSummary, RecentTrainingSummary {
  ageGroup: string | null;
  durationMinutes: number;
  focusCategory: string;
  daysUntilNextMatch: number | null;
}

export interface GeneratedTrainingPhase {
  phase_type?: string;
  title?: string;
  duration_minutes?: number;
  description?: string;
  coaching_points?: string;
  organization?: string;
  material?: string;
  variations?: string;
  load_management?: string;
  diagram?: unknown;
}

export interface GeneratedTrainingPlan {
  focus?: string;
  goal?: string;
  intensity?: string;
  notes?: string;
  phases?: GeneratedTrainingPhase[];
}

const FOCUS_CATEGORIES = [
  { label: "Torabschluss", keywords: ["abschluss", "torschuss", "torabschluss", "finishing", "schuss"] },
  { label: "Pressing und Gegenpressing", keywords: ["gegenpress", "pressing", "anlaufen"] },
  { label: "Umschaltspiel", keywords: ["umschalt", "transition", "konter"] },
  { label: "Defensivverhalten", keywords: ["defens", "verteidig", "zweikampf", "kompakt"] },
  { label: "Passspiel und Ballzirkulation", keywords: ["pass", "ballzirkulation", "kombination", "spielaufbau"] },
  { label: "Ballbesitz", keywords: ["ballbesitz", "possession", "rondo"] },
  { label: "Technik und Koordination", keywords: ["technik", "koordination", "dribbling", "ballkontrolle"] },
  { label: "Athletik", keywords: ["athletik", "sprint", "ausdauer", "kraft", "schnelligkeit"] },
  { label: "Standardsituationen", keywords: ["standard", "ecke", "freistoss", "freistoß", "einwurf"] },
] as const;

/**
 * Converts arbitrary coach input into a controlled category. The original free
 * text never becomes part of the external AI request.
 */
export function normalizeAiTrainingFocus(value: string): string {
  const normalized = value.toLocaleLowerCase("de-CH");
  return (
    FOCUS_CATEGORIES.find(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword)))?.label ??
    "Allgemeine fußballspezifische Entwicklung"
  );
}

/**
 * Only a generic age band is allowed across the AI boundary. Team names or
 * other free-form suffixes are deliberately discarded.
 */
export function normalizeAiAgeGroup(value: string | null): string | null {
  if (!value) return null;

  const youthMatch = value.match(/(?:^|\s)u\s*([5-9]|1\d|2[0-3])(?:\s|$)/i);
  if (youthMatch) return `U${Number(youthMatch[1])}`;

  const normalized = value.toLocaleLowerCase("de-CH");
  if (["erwachsene", "aktive", "senior", "adult"].some((term) => normalized.includes(term))) {
    return "Erwachsene";
  }

  return null;
}

/**
 * Aggregates per-player availability and wellness data locally. Player IDs are
 * used only to join the latest check-in and are never returned.
 *
 * Check-ins must be supplied newest first.
 */
export function aggregateTeamLoadSignals(
  players: AiPlayerSignal[],
  checkins: AiCheckinSignal[],
): TeamLoadSummary {
  const latestByPlayer = new Map<string, AiCheckinSignal>();
  for (const checkin of checkins) {
    if (!latestByPlayer.has(checkin.playerId)) {
      latestByPlayer.set(checkin.playerId, checkin);
    }
  }

  const summary: TeamLoadSummary = {
    totalPlayers: players.length,
    availableCount: 0,
    limitedCount: 0,
    injuredCount: 0,
    absentCount: 0,
    checkinCoverageCount: 0,
    wellnessGreenCount: 0,
    wellnessYellowCount: 0,
    wellnessRedCount: 0,
  };

  for (const player of players) {
    if (player.status === "AVAILABLE") summary.availableCount += 1;
    if (player.status === "LIMITED") summary.limitedCount += 1;
    if (player.status === "INJURED") summary.injuredCount += 1;
    if (player.status === "ABSENT") summary.absentCount += 1;

    const checkin = latestByPlayer.get(player.id);
    if (!checkin) continue;

    summary.checkinCoverageCount += 1;
    const risk = healthRisk({
      fatigue: checkin.fatigue,
      sleep_quality: checkin.sleepQuality ?? 3,
      soreness: checkin.soreness,
      pain: checkin.pain,
      stress: checkin.stress,
      motivation: checkin.motivation,
      energy: checkin.energy ?? 3,
      injury_feeling: checkin.injuryFeeling ?? 3,
      wellbeing: checkin.wellbeing ?? 3,
    });

    if (risk === "green") summary.wellnessGreenCount += 1;
    if (risk === "yellow") summary.wellnessYellowCount += 1;
    if (risk === "red") summary.wellnessRedCount += 1;
  }

  return summary;
}

export function summarizeRecentTrainingIntensity(
  trainings: Array<{ intensity: string | null }>,
): RecentTrainingSummary {
  const summary: RecentTrainingSummary = {
    recentTrainingCount: trainings.length,
    recentLowIntensityCount: 0,
    recentMediumIntensityCount: 0,
    recentHighIntensityCount: 0,
    recentUnknownIntensityCount: 0,
  };

  for (const training of trainings) {
    if (training.intensity === "low") summary.recentLowIntensityCount += 1;
    else if (training.intensity === "medium") summary.recentMediumIntensityCount += 1;
    else if (training.intensity === "high") summary.recentHighIntensityCount += 1;
    else summary.recentUnknownIntensityCount += 1;
  }

  return summary;
}

export function buildTrainingPlanPrompt(params: GenerateTrainingPlanParams): string {
  const ageGroup = normalizeAiAgeGroup(params.ageGroup) ?? "nicht angegeben";
  const focusCategory = normalizeAiTrainingFocus(params.focusCategory);
  const matchDistance =
    params.daysUntilNextMatch === null
      ? "Kein kommendes Spiel bekannt"
      : `Nächstes Spiel in ${Math.max(0, Math.round(params.daysUntilNextMatch))} Tag(en)`;

  return `Du bist ein professioneller Fußballtrainer-Assistent mit Expertise in Trainingslehre und Belastungssteuerung.

Erstelle einen vollständigen, praxisorientierten Trainingsplan ausschließlich aus den folgenden anonymisierten Team-Aggregaten.

## ANONYMISIERTE RAHMENDATEN
Altersstufe: ${ageGroup}
Kadergröße: ${params.totalPlayers}
Verfügbarkeitsstatus: ${params.availableCount} verfügbar, ${params.limitedCount} eingeschränkt, ${params.injuredCount} verletzt, ${params.absentCount} abwesend
Geplante Dauer: ${params.durationMinutes} Minuten
Kontrollierter Schwerpunkt: ${focusCategory}

## AGGREGIERTE BELASTUNGSSIGNALE
Check-in-Abdeckung: ${params.checkinCoverageCount} von ${params.totalPlayers}
Team-Ampel: ${params.wellnessGreenCount} grün, ${params.wellnessYellowCount} gelb, ${params.wellnessRedCount} rot
Letzte Einheiten: ${params.recentTrainingCount} gesamt (${params.recentLowIntensityCount} niedrig, ${params.recentMediumIntensityCount} mittel, ${params.recentHighIntensityCount} hoch, ${params.recentUnknownIntensityCount} ohne Einstufung)
Spielnähe: ${matchDistance}

## DATENSCHUTZ- UND SICHERHEITSREGELN
- Verwende keine Namen, realen IDs, Team- oder Gegnerbezeichnungen.
- Leite keine Aussagen über einzelne Personen ab und erfinde keine personenbezogenen Details.
- Gib keine Diagnosen oder medizinischen Empfehlungen. Formuliere nur allgemeine, gruppenweite Optionen zur Belastungssteuerung.
- Der Trainer entscheidet intern, welche Personen welche Belastungsvariante absolvieren.

## AUFGABE
Erstelle einen detaillierten Trainingsplan als JSON-Objekt. Antworte AUSSCHLIESSLICH mit gültigem JSON – kein Markdown, kein Fließtext.

KOORDINATENSYSTEM für diagram:
- x=0 linke Auslinie, x=100 rechte Auslinie
- y=0 gegnerisches Tor (Angriffsziel), y=100 eigenes Tor
- Team A = angreifendes/pressendes Team (blau), Team B = verteidigendes/aufbauendes Team (rot)
- Neutrale Spieler = Joker/Anspielstation (gelb)
- Alle x/y-Koordinaten zwischen 0 und 100

{
  "focus": "Präziser, eingängiger Trainingstitel (max. 60 Zeichen)",
  "goal": "Konkretes, messbares Trainingsziel – WAS wird trainiert und WARUM heute (2-3 präzise Sätze)",
  "intensity": "low | medium | high",
  "notes": "Allgemeine Trainerhinweise zur Belastungsdosierung und Organisation, ohne personenbezogene Angaben (3-5 Sätze)",
  "phases": [
    {
      "phase_type": "warmup | activation | technique | tactics | game_form | finish | cooldown",
      "title": "Phasentitel (3-5 Wörter)",
      "duration_minutes": 15,
      "description": "Detaillierte Übungsbeschreibung: Aufbau, Ablauf, Positionierung (3-6 Sätze)",
      "coaching_points": "3-5 konkrete Coachingpunkte – eine Zeile je Punkt",
      "organization": "Feldgröße, Gruppenaufteilung, Wechselregeln",
      "material": "Benötigtes Material mit Mengen",
      "variations": "Leichtere und schwierigere Variante",
      "load_management": "Gruppenweite, skalierbare Belastungsoptionen für niedrige, mittlere und hohe Belastbarkeit",
      "diagram": {
        "field": "half | full | third | box",
        "players": [
          { "id": "A1", "team": "A", "role": "ST", "label": "ST", "x": 50, "y": 25 },
          { "id": "B1", "team": "B", "role": "IV", "label": "IV", "x": 50, "y": 40 },
          { "id": "N1", "team": "neutral", "role": "Joker", "label": "J", "x": 15, "y": 50 }
        ],
        "movements": [
          { "from": "A1", "to_x": 60, "to_y": 15, "type": "run | pass | dribble | shot", "label": "Tiefenlauf", "sequence": 1 }
        ],
        "zones": [
          { "label": "Presszone", "x": 20, "y": 15, "w": 60, "h": 25, "color": "red | orange | blue | green" }
        ],
        "goals": [
          { "type": "big_goal | mini_goal", "label": "Tor", "x": 50, "y": 0, "width": 15 }
        ]
      }
    }
  ]
}

QUALITÄTSREGELN:
- 4-6 Phasen, die zusammen exakt ${params.durationMinutes} Minuten ergeben.
- Passe die Gesamtintensität nur anhand der aggregierten Team-Ampel, der letzten Intensitäten und der Spielnähe an.
- Coachingpunkte sind konkret, aber niemals personenbezogen.
- Übungen sind altersgruppengerecht für ${ageGroup}.
- Das Trainingsziel passt exakt zum kontrollierten Schwerpunkt.
- Verwende im Diagramm ausschließlich synthetische Rollen-IDs wie A1, B1 oder N1; keine realen IDs.
- Spieler stehen nicht alle auf einer Linie; Koordinaten und Abstände sind taktisch plausibel.`;
}

export function parseTrainingPlanResponse(rawText: string): GeneratedTrainingPlan {
  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    return JSON.parse(jsonText) as GeneratedTrainingPlan;
  } catch {
    // Never log the raw model response: it may contain generated personal data.
    logger.error("AI model returned invalid JSON");
    throw new Error("Die KI hat ein ungültiges Format zurückgegeben. Bitte erneut versuchen.");
  }
}

export async function generateTrainingPlan(
  params: GenerateTrainingPlanParams,
): Promise<GeneratedTrainingPlan> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert. Bitte in .env.local setzen.");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: buildTrainingPlanPrompt(params) }],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  return parseTrainingPlanResponse(rawText);
}
