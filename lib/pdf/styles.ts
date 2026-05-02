import { StyleSheet } from "@react-pdf/renderer";

// SC Emmen / CoachOS brand palette translated for print.
// All values are in pt (1pt ≈ 1.333 px). A4 = 595 × 842 pt.
export const palette = {
  ink: "#0B0F0E",
  inkSoft: "#3A4441",
  inkMuted: "#6B7672",
  paper: "#FFFFFF",
  paperSoft: "#F4F6F5",
  paperEdge: "#E5E9E7",
  border: "#D4DAD7",
  brand: "#0A4D3A", // SC Emmen tiefes Grün
  brandSoft: "#E1ECE6",
  accent: "#B11226", // dezenter Akzent für Highlights
  warning: "#A36300"
} as const;

export const fontStack = "Helvetica";
export const fontStackBold = "Helvetica-Bold";

export const baseStyles = StyleSheet.create({
  page: {
    backgroundColor: palette.paper,
    color: palette.ink,
    fontFamily: fontStack,
    fontSize: 10,
    lineHeight: 1.45,
    paddingTop: 96,
    paddingBottom: 56,
    paddingHorizontal: 44
  },
  // Branded header band
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 28,
    paddingBottom: 18,
    paddingHorizontal: 44,
    backgroundColor: palette.brand,
    color: palette.paper,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerEyebrow: {
    fontFamily: fontStackBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: palette.brandSoft,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  headerTitle: {
    fontFamily: fontStackBold,
    fontSize: 18,
    color: palette.paper
  },
  headerMeta: {
    fontSize: 9,
    color: palette.brandSoft,
    textAlign: "right",
    lineHeight: 1.4
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    color: palette.inkMuted,
    fontSize: 8,
    borderTopWidth: 0.5,
    borderTopColor: palette.border,
    paddingTop: 8
  },
  // Section primitives
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    fontFamily: fontStackBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.inkSoft,
    marginBottom: 8
  },
  sectionDivider: {
    height: 0.5,
    backgroundColor: palette.border,
    marginBottom: 10
  },
  // Key/Value tile grid
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 16
  },
  metaTile: {
    width: "25%",
    paddingHorizontal: 4,
    marginBottom: 8
  },
  metaTileInner: {
    backgroundColor: palette.paperSoft,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40
  },
  metaLabel: {
    fontSize: 8,
    color: palette.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2
  },
  metaValue: {
    fontFamily: fontStackBold,
    fontSize: 11,
    color: palette.ink
  },
  // Phase / list cards
  phaseCard: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: palette.border,
    borderRadius: 6,
    marginBottom: 8,
    overflow: "hidden"
  },
  phaseIndex: {
    width: 32,
    backgroundColor: palette.brand,
    color: palette.paper,
    fontFamily: fontStackBold,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12
  },
  phaseBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  phaseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  phaseTypeBadge: {
    fontSize: 8,
    fontFamily: fontStackBold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: palette.brand
  },
  phaseTitle: {
    fontFamily: fontStackBold,
    fontSize: 11,
    color: palette.ink,
    marginTop: 1
  },
  phaseDuration: {
    fontFamily: fontStackBold,
    fontSize: 10,
    color: palette.inkSoft
  },
  phaseDescription: {
    fontSize: 9,
    color: palette.inkSoft,
    marginTop: 4
  },
  phaseSubLabel: {
    fontFamily: fontStackBold,
    fontSize: 8,
    color: palette.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 6
  },
  phaseSubText: {
    fontSize: 9,
    color: palette.inkSoft,
    marginTop: 1
  },
  // Callouts
  callout: {
    backgroundColor: palette.brandSoft,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14
  },
  calloutLabel: {
    fontFamily: fontStackBold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: palette.brand,
    marginBottom: 2
  },
  calloutText: {
    fontSize: 10,
    color: palette.ink
  },
  // Tables
  table: {
    borderWidth: 0.5,
    borderColor: palette.border,
    borderRadius: 6,
    overflow: "hidden"
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: palette.brand,
    color: palette.paper
  },
  tableHeaderCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: fontStackBold,
    fontSize: 9,
    color: palette.paper
  },
  tableRow: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: palette.border
  },
  tableRowAlt: {
    backgroundColor: palette.paperSoft
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
    color: palette.ink
  },
  // Attendance / checkbox row
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderTopWidth: 0.5,
    borderTopColor: palette.border
  },
  checkbox: {
    width: 11,
    height: 11,
    borderWidth: 0.8,
    borderColor: palette.inkSoft,
    borderRadius: 2,
    marginRight: 10
  },
  // Misc
  paragraph: {
    fontSize: 10,
    color: palette.ink,
    marginBottom: 6
  },
  small: {
    fontSize: 9,
    color: palette.inkMuted
  }
});
