import Anthropic from "@anthropic-ai/sdk";

export interface GenerateTrainingPlanParams {
  teamName: string;
  ageGroup: string | null;
  totalPlayers: number;
  availableCount: number;
  limitedCount: number;
  injuredCount: number;
  date: string;
  durationMinutes: number;
  focus: string;
  additionalContext?: string;
  wellnessLines: string;
  recentLines: string;
  matchLine: string;
}

export async function generateTrainingPlan(params: GenerateTrainingPlanParams) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert. Bitte in .env.local setzen.");
  }

  const prompt = `Du bist ein professioneller Fußballtrainer-Assistent mit tiefer Expertise in modernem Fußball-Training, Trainingslehre und Belastungssteuerung.

Erstelle einen vollständigen, praxisorientierten Trainingsplan für folgendes Team.

## TEAM
Name: ${params.teamName}
Altersstufe: ${params.ageGroup ?? "nicht angegeben"}
Kader: ${params.totalPlayers} Spieler (${params.availableCount} fit, ${params.limitedCount} eingeschränkt, ${params.injuredCount} verletzt)
Trainingsdatum: ${params.date}
Geplante Dauer: ${params.durationMinutes} Minuten

## TRAINER-VORGABE
Schwerpunkt: "${params.focus}"${params.additionalContext ? `\nZusätzliche Anweisungen: "${params.additionalContext}"` : ""}

## WELLNESS-STATUS ALLER SPIELER (letzte 7 Tage)
${params.wellnessLines || "Keine Check-in-Daten vorhanden — Standardbelastung ansetzen"}

## LETZTE TRAININGS
${params.recentLines}

## NÄCHSTES SPIEL
${params.matchLine}

## AUFGABE
Erstelle einen detaillierten Trainingsplan als JSON-Objekt. Antworte AUSSCHLIESSLICH mit gültigem JSON — kein Markdown, kein Fließtext.

KOORDINATENSYSTEM für diagram:
- x=0 linke Auslinie, x=100 rechte Auslinie
- y=0 gegnerisches Tor (Angriffsziel), y=100 eigenes Tor
- Team A = angreifendes/pressendes Team (blau), Team B = verteidigende/aufbauendes Team (rot)
- Neutrale Spieler = Joker/Anspielstation (gelb)
- Alle x/y-Koordinaten zwischen 0 und 100

{
  "focus": "Präziser, eingängiger Trainingstitel (max 60 Zeichen)",
  "goal": "Konkretes, messbares Trainingsziel — WAS wird trainiert und WARUM heute (2-3 präzise Sätze)",
  "intensity": "low" | "medium" | "high",
  "notes": "Trainer-Notizen: Welche Spieler heute namentlich schonen? Welche Belastungsanpassungen? Worauf besonders achten? (3-5 Sätze, sehr konkret)",
  "phases": [
    {
      "phase_type": "warmup" | "activation" | "technique" | "tactics" | "game_form" | "finish" | "cooldown",
      "title": "Phasentitel (3-5 Wörter)",
      "duration_minutes": Zahl,
      "description": "Detaillierte Übungsbeschreibung: Aufbau, Ablauf, Spielerpositionierung (3-6 Sätze)",
      "coaching_points": "3-5 konkrete Coachingpunkte die der Trainer aktiv einfordert — eine Zeile je Punkt",
      "organization": "Feldgröße, Gruppenaufteilung, Wechselregeln",
      "material": "Konkretes Material z.B. '6 Bälle, 8 Hütchen, 4 Leibchen, 2 Kleintore'",
      "variations": "Leichtere Variante / Schwierigere Variante (je eine Zeile)",
      "load_management": "Wie absolvieren eingeschränkte Spieler diese Phase konkret?",
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
- 4-6 Phasen die zusammen exakt ${params.durationMinutes} Minuten ergeben
- Intensität: Viele 🔴/🟡 Spieler → "low", gemischtes Team → "medium", frisches Team → "high"
- Coachingpunkte sind KONKRET (nicht 'Kommunikation' sondern 'Spieler ruft den Namen vor dem Pass')
- 🔴-Spieler werden namentlich in notes UND load_management erwähnt
- Übungen sind altersgruppengerecht für ${params.ageGroup ?? "die Altersgruppe"}
- Das Trainingsziel passt exakt zum Schwerpunkt
- DIAGRAM-REGELN: Spieler nie alle auf einer Linie. Koordinaten taktisch sinnvoll. Warmup/Cooldown: Kreis- oder Reihenformation. Taktik/Spielform: realistische Abstände, erkennbare Struktur. movements.from muss eine existierende player id sein. Alle x/y zwischen 0 und 100.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("AI returned invalid JSON: ", rawText);
    throw new Error("Die KI hat ein ungültiges Format zurückgegeben. Bitte erneut versuchen.");
  }
}
