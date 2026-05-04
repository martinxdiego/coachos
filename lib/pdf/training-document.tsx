import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  PdfCallout,
  PdfChecklistRow,
  PdfFooter,
  PdfHeader,
  PdfKeyValueBlock,
  PdfMetaGrid,
  PdfPhaseImages,
  PdfSection
} from "./components";
import { baseStyles, palette } from "./styles";
import type { TrainingPhase, TrainingPhaseType } from "@/lib/types";

const phaseLabels: Record<TrainingPhaseType, string> = {
  cooldown: "Cooldown",
  finish: "Abschluss",
  game_form: "Spielform",
  tactics: "Taktik",
  technique: "Technik",
  warmup: "Warm-up"
};

const dateFormatter = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  weekday: "long"
});

function formatTrainingDate(value: string) {
  try {
    return dateFormatter.format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function formatTime(value: string | null) {
  if (!value) return "Offen";
  return value.slice(0, 5);
}

export interface TrainingDocumentInput {
  teamName: string;
  generatedAt: string;
  training: {
    date: string;
    start_time: string | null;
    duration_minutes: number | null;
    location: string | null;
    focus: string;
    goal: string | null;
    age_group: string | null;
    intensity: string | null;
    participants: string | null;
    notes: string | null;
  };
  phases: TrainingPhase[];
  players: { id: string; name: string; position: string | null }[];
  // Pre-fetched, render-safe data URLs per phase id. The route layer is
  // responsible for downloading the images and converting unsupported formats —
  // the document just renders whatever made it through.
  phaseImageData?: Record<string, string[]>;
}

export function TrainingDocument({
  teamName,
  generatedAt,
  training,
  phases,
  players,
  phaseImageData
}: TrainingDocumentInput) {
  const phaseMinutes = phases.reduce(
    (sum, phase) => sum + (phase.duration_minutes ?? 0),
    0
  );
  const totalMinutes = training.duration_minutes ?? phaseMinutes;
  const sortedPhases = [...phases].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const intensityLabel =
    training.intensity === "high"
      ? "Hoch"
      : training.intensity === "low"
        ? "Niedrig"
        : training.intensity === "medium"
          ? "Mittel"
          : "Offen";

  const metaItems = [
    { label: "Datum", value: formatTrainingDate(training.date) },
    { label: "Uhrzeit", value: formatTime(training.start_time) },
    {
      label: "Dauer",
      value: totalMinutes ? `${totalMinutes} Min.` : "Offen"
    },
    { label: "Intensität", value: intensityLabel },
    { label: "Ort", value: training.location ?? "Offen" },
    { label: "Altersstufe", value: training.age_group ?? "Offen" },
    { label: "Teilnehmer", value: training.participants ?? "Offen" },
    { label: "Phasen", value: `${sortedPhases.length}` }
  ];

  return (
    <Document
      author={teamName}
      creator="CoachOS"
      producer="CoachOS"
      title={`Training · ${training.focus}`}
    >
      <Page size="A4" style={baseStyles.page}>
        <PdfHeader
          eyebrow="Trainingsplan"
          meta={[teamName, generatedAt]}
          title={training.focus}
        />

        <PdfMetaGrid items={metaItems} />

        {training.goal ? (
          <PdfCallout label="Trainingsziel" text={training.goal} />
        ) : null}

        <PdfSection title="Ablauf">
          {sortedPhases.length > 0 ? (
            sortedPhases.map((phase, index) => {
              const phaseImages = phaseImageData?.[phase.id] ?? [];
              const hasImages = phaseImages.length > 0;
              // wrap={false} only when the card stays small enough to fit on
              // a single page. With images we let react-pdf paginate naturally.
              return (
              <View
                key={phase.id}
                style={baseStyles.phaseCard}
                wrap={hasImages}
              >
                <Text style={baseStyles.phaseIndex}>{index + 1}</Text>
                <View style={baseStyles.phaseBody}>
                  <View style={baseStyles.phaseHeaderRow}>
                    <View style={{ flexDirection: "column", flex: 1 }}>
                      <Text style={baseStyles.phaseTypeBadge}>
                        {phaseLabels[phase.phase_type] ?? phase.phase_type}
                      </Text>
                      <Text style={baseStyles.phaseTitle}>{phase.title}</Text>
                    </View>
                    <Text style={baseStyles.phaseDuration}>
                      {phase.duration_minutes
                        ? `${phase.duration_minutes} Min.`
                        : "—"}
                    </Text>
                  </View>
                  {phase.description ? (
                    <Text style={baseStyles.phaseDescription}>
                      {phase.description}
                    </Text>
                  ) : null}
                  <PdfKeyValueBlock
                    label="Coachingpunkte"
                    text={phase.coaching_points}
                  />
                  <PdfKeyValueBlock
                    label="Organisation"
                    text={phase.organization}
                  />
                  <View style={{ flexDirection: "row", marginTop: 4 }}>
                    {phase.material ? (
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={baseStyles.phaseSubLabel}>Material</Text>
                        <Text style={baseStyles.phaseSubText}>
                          {phase.material}
                        </Text>
                      </View>
                    ) : null}
                    {phase.player_count ? (
                      <View style={{ flex: 1, paddingHorizontal: 6 }}>
                        <Text style={baseStyles.phaseSubLabel}>Spieler</Text>
                        <Text style={baseStyles.phaseSubText}>
                          {phase.player_count}
                        </Text>
                      </View>
                    ) : null}
                    {phase.field_size ? (
                      <View style={{ flex: 1, paddingLeft: 6 }}>
                        <Text style={baseStyles.phaseSubLabel}>Feldgröße</Text>
                        <Text style={baseStyles.phaseSubText}>
                          {phase.field_size}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <PdfKeyValueBlock
                    label="Varianten"
                    text={phase.variations}
                  />
                  <PdfKeyValueBlock
                    label="Belastungssteuerung"
                    text={phase.load_management}
                  />
                  {hasImages ? (
                    <View style={{ marginTop: 6 }}>
                      <Text style={baseStyles.phaseSubLabel}>
                        Skizzen / Bilder
                      </Text>
                      <PdfPhaseImages
                        images={phaseImages.map((src) => ({ src }))}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
              );
            })
          ) : (
            <Text style={baseStyles.small}>
              Noch keine Phasen erfasst. Die Planung kann live ergänzt werden.
            </Text>
          )}
        </PdfSection>

        {training.notes ? (
          <PdfSection title="Notizen">
            <Text style={baseStyles.paragraph}>{training.notes}</Text>
          </PdfSection>
        ) : null}

        {players.length > 0 ? (
          <PdfSection title="Anwesenheit">
            <View style={[baseStyles.table, { borderTopWidth: 0 }]}>
              <View style={baseStyles.tableHeader}>
                <Text
                  style={[baseStyles.tableHeaderCell, { flex: 1.2 }]}
                >
                  Spieler
                </Text>
                <Text
                  style={[baseStyles.tableHeaderCell, { width: 100 }]}
                >
                  Position
                </Text>
                <Text
                  style={[
                    baseStyles.tableHeaderCell,
                    { width: 60, textAlign: "center" }
                  ]}
                >
                  Anwesend
                </Text>
              </View>
              {players.map((player, idx) => (
                <View
                  key={player.id}
                  style={[
                    baseStyles.tableRow,
                    idx % 2 === 1 ? baseStyles.tableRowAlt : {}
                  ]}
                >
                  <Text style={[baseStyles.tableCell, { flex: 1.2 }]}>
                    {player.name}
                  </Text>
                  <Text
                    style={[
                      baseStyles.tableCell,
                      { width: 100, color: palette.inkMuted }
                    ]}
                  >
                    {player.position ?? "—"}
                  </Text>
                  <View
                    style={[
                      baseStyles.tableCell,
                      {
                        width: 60,
                        flexDirection: "row",
                        justifyContent: "center"
                      }
                    ]}
                  >
                    <View style={baseStyles.checkbox} />
                  </View>
                </View>
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 22,
                paddingTop: 10,
                borderTopWidth: 0.5,
                borderTopColor: palette.border
              }}
            >
              <View style={{ width: "45%" }}>
                <View
                  style={{
                    height: 0.6,
                    backgroundColor: palette.inkMuted,
                    marginBottom: 4
                  }}
                />
                <Text style={baseStyles.small}>Datum</Text>
              </View>
              <View style={{ width: "45%" }}>
                <View
                  style={{
                    height: 0.6,
                    backgroundColor: palette.inkMuted,
                    marginBottom: 4
                  }}
                />
                <Text style={baseStyles.small}>Unterschrift Trainer</Text>
              </View>
            </View>
          </PdfSection>
        ) : null}

        <PdfFooter teamName={teamName} />
      </Page>
    </Document>
  );
}

// Re-exported for the unused import linter; PdfChecklistRow is used elsewhere.
export { PdfChecklistRow };
