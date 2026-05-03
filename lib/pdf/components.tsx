import { Image, Text, View } from "@react-pdf/renderer";
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

export interface PdfPhaseImage {
  src: string;
  caption?: string;
}

export function PdfPhaseImages({ images }: { images: PdfPhaseImage[] }) {
  if (images.length === 0) return null;

  // 1 → full width, 2 → 50/50, 3+ → 1/3 each so a row of three fits cleanly.
  const widthPercent =
    images.length === 1 ? "100%" : images.length === 2 ? "50%" : "33.333%";

  return (
    <View style={baseStyles.phaseImagesWrap} wrap={false}>
      {images.map((image, idx) => (
        <View
          key={`${image.src}-${idx}`}
          style={[baseStyles.phaseImageTile, { width: widthPercent }]}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image, not <img>. */}
          <Image src={image.src} style={baseStyles.phaseImage} />
          {image.caption ? (
            <Text style={baseStyles.phaseImageCaption}>{image.caption}</Text>
          ) : null}
        </View>
      ))}
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
