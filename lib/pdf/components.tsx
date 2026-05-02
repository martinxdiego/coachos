import { Text, View } from "@react-pdf/renderer";
import { baseStyles, palette } from "./styles";

export function PdfHeader({
  eyebrow,
  title,
  meta
}: {
  eyebrow: string;
  title: string;
  meta?: string[];
}) {
  return (
    <View fixed style={baseStyles.header}>
      <View>
        <Text style={baseStyles.headerEyebrow}>{eyebrow}</Text>
        <Text style={baseStyles.headerTitle}>{title}</Text>
      </View>
      {meta && meta.length > 0 ? (
        <View>
          {meta.map((line, idx) => (
            <Text key={idx} style={baseStyles.headerMeta}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PdfFooter({ teamName }: { teamName: string }) {
  return (
    <View fixed style={baseStyles.footer}>
      <Text>{teamName} · CoachOS</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Seite ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function PdfSection({
  title,
  children
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={baseStyles.section}>
      {title ? (
        <>
          <Text style={baseStyles.sectionTitle}>{title}</Text>
          <View style={baseStyles.sectionDivider} />
        </>
      ) : null}
      {children}
    </View>
  );
}

export function PdfMetaGrid({
  items
}: {
  items: { label: string; value: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={baseStyles.metaGrid}>
      {items.map((item, idx) => (
        <View key={idx} style={baseStyles.metaTile}>
          <View style={baseStyles.metaTileInner}>
            <Text style={baseStyles.metaLabel}>{item.label}</Text>
            <Text style={baseStyles.metaValue}>{item.value || "—"}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function PdfCallout({
  label,
  text
}: {
  label: string;
  text: string;
}) {
  if (!text) return null;
  return (
    <View style={baseStyles.callout}>
      <Text style={baseStyles.calloutLabel}>{label}</Text>
      <Text style={baseStyles.calloutText}>{text}</Text>
    </View>
  );
}

export function PdfKeyValueBlock({
  label,
  text
}: {
  label: string;
  text: string | null | undefined;
}) {
  if (!text) return null;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={baseStyles.phaseSubLabel}>{label}</Text>
      <Text style={baseStyles.phaseSubText}>{text}</Text>
    </View>
  );
}

export function PdfChecklistRow({
  primary,
  secondary
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <View style={baseStyles.checkboxRow}>
      <View style={baseStyles.checkbox} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, color: palette.ink }}>{primary}</Text>
        {secondary ? (
          <Text style={{ fontSize: 8, color: palette.inkMuted, marginTop: 1 }}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
