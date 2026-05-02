import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  PdfCallout,
  PdfFooter,
  PdfHeader,
  PdfKeyValueBlock,
  PdfMetaGrid,
  PdfSection
} from "./components";
import { baseStyles, palette } from "./styles";

const dateFormatter = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  weekday: "long"
});

function formatMatchDate(value: string) {
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

function homeAwayLabel(value: string | null) {
  if (value === "home") return "Heimspiel";
  if (value === "away") return "Auswärtsspiel";
  if (value === "neutral") return "Neutrale Anlage";
  return "Offen";
}

export interface MatchDocumentInput {
  teamName: string;
  generatedAt: string;
  match: {
    opponent: string;
    date: string;
    kickoff_time: string | null;
    location: string | null;
    home_away: string | null;
    competition: string | null;
    team_category: string | null;
    meeting_point: string | null;
    formation: string | null;
    starting_lineup: string | null;
    substitutes: string | null;
    tactical_instructions: string | null;
    match_goals: string | null;
    pre_match_notes: string | null;
    halftime_notes: string | null;
    post_match_notes: string | null;
    squad_notes: string | null;
    notes: string | null;
    result: string | null;
    scorers: string | null;
    assists: string | null;
    cards: string | null;
  };
}

export function MatchDocument({
  teamName,
  generatedAt,
  match
}: MatchDocumentInput) {
  const metaItems = [
    { label: "Datum", value: formatMatchDate(match.date) },
    { label: "Anstoss", value: formatTime(match.kickoff_time) },
    { label: "Ort", value: match.location ?? "Offen" },
    { label: "Heim/Auswärts", value: homeAwayLabel(match.home_away) },
    { label: "Wettbewerb", value: match.competition ?? "Offen" },
    { label: "Kategorie", value: match.team_category ?? "Offen" },
    { label: "Treffpunkt", value: match.meeting_point ?? "Offen" },
    { label: "Formation", value: match.formation ?? "Offen" }
  ];

  return (
    <Document
      author={teamName}
      creator="CoachOS"
      producer="CoachOS"
      title={`Spielplan · ${match.opponent}`}
    >
      <Page size="A4" style={baseStyles.page}>
        <PdfHeader
          eyebrow="Spielplan"
          meta={[teamName, generatedAt]}
          title={`vs. ${match.opponent}`}
        />

        <PdfMetaGrid items={metaItems} />

        {match.match_goals ? (
          <PdfCallout label="Matchziele" text={match.match_goals} />
        ) : null}

        <PdfSection title="Aufstellung">
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginBottom: 6
            }}
          >
            <View
              style={{
                flex: 1,
                borderWidth: 0.5,
                borderColor: palette.border,
                borderRadius: 6,
                padding: 10
              }}
            >
              <Text style={baseStyles.phaseSubLabel}>Startformation</Text>
              <Text style={[baseStyles.paragraph, { marginTop: 4 }]}>
                {match.starting_lineup ?? "Noch nicht festgelegt."}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                borderWidth: 0.5,
                borderColor: palette.border,
                borderRadius: 6,
                padding: 10
              }}
            >
              <Text style={baseStyles.phaseSubLabel}>Auswechselspieler</Text>
              <Text style={[baseStyles.paragraph, { marginTop: 4 }]}>
                {match.substitutes ?? "Offen."}
              </Text>
            </View>
          </View>
          <PdfKeyValueBlock label="Notizen Kader" text={match.squad_notes} />
        </PdfSection>

        <PdfSection title="Taktik & Vorbereitung">
          <PdfKeyValueBlock
            label="Taktische Vorgaben"
            text={match.tactical_instructions}
          />
          <PdfKeyValueBlock
            label="Vor dem Spiel"
            text={match.pre_match_notes}
          />
          <PdfKeyValueBlock label="Halbzeit" text={match.halftime_notes} />
          <PdfKeyValueBlock
            label="Nach dem Spiel"
            text={match.post_match_notes}
          />
        </PdfSection>

        {match.result || match.scorers || match.assists || match.cards ? (
          <PdfSection title="Ergebnis">
            <View style={baseStyles.metaGrid}>
              <View style={[baseStyles.metaTile, { width: "50%" }]}>
                <View style={baseStyles.metaTileInner}>
                  <Text style={baseStyles.metaLabel}>Resultat</Text>
                  <Text style={baseStyles.metaValue}>
                    {match.result ?? "—"}
                  </Text>
                </View>
              </View>
              <View style={[baseStyles.metaTile, { width: "50%" }]}>
                <View style={baseStyles.metaTileInner}>
                  <Text style={baseStyles.metaLabel}>Karten</Text>
                  <Text style={baseStyles.metaValue}>
                    {match.cards ?? "—"}
                  </Text>
                </View>
              </View>
            </View>
            <PdfKeyValueBlock label="Torschützen" text={match.scorers} />
            <PdfKeyValueBlock label="Vorlagen" text={match.assists} />
          </PdfSection>
        ) : null}

        {match.notes ? (
          <PdfSection title="Allgemeine Notizen">
            <Text style={baseStyles.paragraph}>{match.notes}</Text>
          </PdfSection>
        ) : null}

        <PdfFooter teamName={teamName} />
      </Page>
    </Document>
  );
}
