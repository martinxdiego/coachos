import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  PdfFooter,
  PdfHeader,
  PdfSection
} from "./components";
import { baseStyles, palette } from "./styles";
import type { MaterialType, PlayerStatus } from "@/lib/types";

const materialLabels: Record<MaterialType, string> = {
  attendance_list: "Anwesenheitsliste",
  exercise_sheet: "Übungsblatt",
  match_plan: "Matchplan",
  month_plan: "Monatsplan",
  player_list: "Spielerliste",
  tactics_sheet: "Taktikblatt",
  training_plan: "Trainingsplan",
  week_plan: "Wochenplan"
};

export interface MaterialPlayerRow {
  id: string;
  name: string;
  position: string | null;
  birth_year: number | null;
  jersey_number: number | null;
  status: PlayerStatus;
}

export interface MaterialDocumentInput {
  teamName: string;
  generatedAt: string;
  material: {
    type: MaterialType;
    title: string;
    description: string | null;
    content: string | null;
  };
  players: MaterialPlayerRow[];
}

function PlayerListBody({ players }: { players: MaterialPlayerRow[] }) {
  return (
    <View style={baseStyles.table}>
      <View style={baseStyles.tableHeader}>
        <Text style={[baseStyles.tableHeaderCell, { width: 30 }]}>Nr.</Text>
        <Text style={[baseStyles.tableHeaderCell, { flex: 1.4 }]}>Name</Text>
        <Text style={[baseStyles.tableHeaderCell, { flex: 1 }]}>Position</Text>
        <Text style={[baseStyles.tableHeaderCell, { width: 60 }]}>Jg.</Text>
        <Text style={[baseStyles.tableHeaderCell, { width: 70 }]}>Status</Text>
      </View>
      {players.map((player, idx) => (
        <View
          key={player.id}
          style={[
            baseStyles.tableRow,
            idx % 2 === 1 ? baseStyles.tableRowAlt : {}
          ]}
        >
          <Text style={[baseStyles.tableCell, { width: 30 }]}>
            {player.jersey_number ?? "—"}
          </Text>
          <Text
            style={[
              baseStyles.tableCell,
              { flex: 1.4, color: palette.ink }
            ]}
          >
            {player.name}
          </Text>
          <Text
            style={[
              baseStyles.tableCell,
              { flex: 1, color: palette.inkMuted }
            ]}
          >
            {player.position ?? "—"}
          </Text>
          <Text
            style={[
              baseStyles.tableCell,
              { width: 60, color: palette.inkMuted }
            ]}
          >
            {player.birth_year ?? "—"}
          </Text>
          <Text
            style={[
              baseStyles.tableCell,
              { width: 70, color: palette.inkMuted }
            ]}
          >
            {player.status}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AttendanceBody({ players }: { players: MaterialPlayerRow[] }) {
  return (
    <View style={baseStyles.table}>
      <View style={baseStyles.tableHeader}>
        <Text style={[baseStyles.tableHeaderCell, { flex: 1.6 }]}>Spieler</Text>
        <Text style={[baseStyles.tableHeaderCell, { flex: 1 }]}>Position</Text>
        <Text
          style={[
            baseStyles.tableHeaderCell,
            { width: 60, textAlign: "center" }
          ]}
        >
          Hier
        </Text>
        <Text
          style={[
            baseStyles.tableHeaderCell,
            { width: 60, textAlign: "center" }
          ]}
        >
          Fehlt
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
          <Text style={[baseStyles.tableCell, { flex: 1.6 }]}>
            {player.name}
          </Text>
          <Text
            style={[
              baseStyles.tableCell,
              { flex: 1, color: palette.inkMuted }
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
  );
}

function ContentBody({ content }: { content: string | null }) {
  return (
    <View
      style={{
        borderWidth: 0.5,
        borderColor: palette.border,
        borderRadius: 6,
        padding: 12,
        backgroundColor: palette.paperSoft
      }}
    >
      <Text style={baseStyles.paragraph}>{content || "—"}</Text>
    </View>
  );
}

export function MaterialDocument({
  teamName,
  generatedAt,
  material,
  players
}: MaterialDocumentInput) {
  return (
    <Document
      author={teamName}
      creator="CoachOS"
      producer="CoachOS"
      title={`${materialLabels[material.type]} · ${material.title}`}
    >
      <Page size="A4" style={baseStyles.page}>
        <PdfHeader
          eyebrow={materialLabels[material.type]}
          meta={[teamName, generatedAt]}
          title={material.title}
        />

        {material.description ? (
          <View
            style={{
              marginBottom: 16,
              padding: 10,
              backgroundColor: palette.brandSoft,
              borderRadius: 6
            }}
          >
            <Text style={{ color: palette.ink }}>
              {material.description}
            </Text>
          </View>
        ) : null}

        {material.type === "player_list" ? (
          <PlayerListBody players={players} />
        ) : material.type === "attendance_list" ? (
          <AttendanceBody players={players} />
        ) : (
          <PdfSection
            title={
              material.type === "training_plan"
                ? "Trainingsablauf"
                : material.type === "match_plan"
                  ? "Spielplan"
                  : material.type === "week_plan"
                    ? "Wochenübersicht"
                    : material.type === "month_plan"
                      ? "Monatsübersicht"
                      : "Inhalt"
            }
          >
            <ContentBody content={material.content} />
          </PdfSection>
        )}

        <PdfFooter teamName={teamName} />
      </Page>
    </Document>
  );
}
