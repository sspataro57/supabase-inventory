import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ReportDef } from "../registry";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, padding: 36, paddingBottom: 48 },
  header: { marginBottom: 12 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#6b7280" },
  table: { width: "100%" },
  thead: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1 solid #e5e7eb" },
  tbody: {},
  tr: { flexDirection: "row", borderBottom: "1 solid #f3f4f6" },
  trAlt: { flexDirection: "row", borderBottom: "1 solid #f3f4f6", backgroundColor: "#fafafa" },
  th: { fontFamily: "Helvetica-Bold", padding: "4 6", color: "#374151" },
  td: { padding: "3 6", color: "#111827" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#9ca3af",
  },
  signatureBlock: {
    marginTop: 24,
    borderTop: "1 solid #d1d5db",
    paddingTop: 12,
    flexDirection: "row",
    gap: 40,
  },
  signatureField: { flex: 1 },
  signatureLabel: { fontSize: 7, color: "#6b7280", marginBottom: 16 },
  signatureLine: { borderBottom: "1 solid #374151", marginBottom: 4 },
});

type ColDef = { key: string; label: string; width: number; numeric?: boolean; date?: boolean };

type Props = {
  report: ReportDef;
  rows: Record<string, unknown>[];
  params: Record<string, unknown>;
  generatedAt: string;
  columns: ColDef[];
  isCountSheet?: boolean;
};

function formatCell(value: unknown, col: ColDef): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (col.date && typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US");
  }
  if (col.numeric && typeof value === "number") return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return String(value);
}

export function ReportDocument({ report, rows, params, generatedAt, columns, isCountSheet }: Props) {
  const paramSummary = Object.entries(params)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  ·  ");

  const ROWS_PER_PAGE = 25;

  return (
    <Document>
      {Array.from({ length: Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE)) }, (_, pageIdx) => {
        const pageRows = rows.slice(pageIdx * ROWS_PER_PAGE, (pageIdx + 1) * ROWS_PER_PAGE);
        const isLast = pageIdx === Math.ceil(rows.length / ROWS_PER_PAGE) - 1;
        const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

        return (
          <Page key={pageIdx} size="LETTER" orientation="landscape" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{report.name}</Text>
              <Text style={styles.subtitle}>
                Generated {generatedAt}
                {paramSummary ? `  ·  ${paramSummary}` : ""}
              </Text>
            </View>

            {/* Table */}
            <View style={styles.table}>
              <View style={styles.thead}>
                {columns.map((col) => (
                  <Text key={col.key} style={[styles.th, { width: col.width, textAlign: col.numeric ? "right" : "left" }]}>
                    {col.label}
                  </Text>
                ))}
              </View>
              <View style={styles.tbody}>
                {pageRows.map((row, i) => (
                  <View key={i} style={i % 2 === 0 ? styles.tr : styles.trAlt}>
                    {columns.map((col) => (
                      <Text key={col.key} style={[styles.td, { width: col.width, textAlign: col.numeric ? "right" : "left" }]}>
                        {col.key.startsWith("_") ? "" : formatCell(row[col.key], col)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            {/* Signature block on last page of count sheet */}
            {isCountSheet && isLast && (
              <View style={styles.signatureBlock}>
                {["Counted by", "Date", "Verified by", "Date"].map((label) => (
                  <View key={label} style={styles.signatureField}>
                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer}>
              <Text>Inventory Management System</Text>
              <Text>Page {pageIdx + 1} of {totalPages}</Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
