import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useBusiness } from "../lib/business";
import { useBusinessGate } from "../components/BusinessGate";
import { usePrivacy } from "../lib/privacy";
import { PLAN_LIMITS } from "../types/pinak";
import { useNav } from "../nav";
import { computeBalance, useTransactions } from "../lib/transactions";
import { exportTransactionsToExcel, exportTransactionsToPdf } from "../lib/reports";
import { AppHeader } from "../components/AppHeader";
import { colors, themedStyles } from "../theme";
import type { Transaction } from "../types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type Range = "7d" | "30d" | "month" | "all";

const RANGE_LABELS: Record<Range, string> = {
  "7d": "7 días",
  "30d": "30 días",
  month: "Este mes",
  all: "Todo",
};

const ALL_LIMIT = 1000;

/** Inicio del periodo (null = sin límite inferior). */
function rangeStart(range: Range): Date | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(now);
  start.setDate(now.getDate() - (range === "7d" ? 7 : 30));
  return start;
}

export default function ReportsScreen({ onBack }: { onBack: () => void }) {
  const { business } = useBusiness();
  const { money } = usePrivacy();
  const nav = useNav();
  const [range, setRange] = useState<Range>("30d");
  // Solo se escuchan los movimientos del periodo elegido ("Todo" trae los últimos 1000).
  const since = useMemo(() => rangeStart(range), [range]);
  const { transactions, loading, error, retry } = useTransactions(business?.id, {
    since: since ?? undefined,
    limit: range === "all" ? ALL_LIMIT : undefined,
  });
  const truncated = range === "all" && transactions.length >= ALL_LIMIT;
  const [exporting, setExporting] = useState(false);

  const filtered = transactions;

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;
  const canExport = PLAN_LIMITS[biz.plan].exports;

  const { balance, totalIngresos, totalEgresos } = computeBalance(filtered);
  const businessName = biz.name;

  async function handleExport(fn: (b: string, t: Transaction[]) => Promise<void>) {
    setExporting(true);
    try {
      await fn(businessName, filtered);
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <AppHeader onBack={onBack} backLabel="Dashboard" title="Reportes" />

      <FlatList
        data={filtered.slice(0, 20)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.rangeRow}>
              {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rangeChip, range === r && styles.rangeChipActive]}
                  onPress={() => setRange(r)}
                >
                  <Text style={range === r ? styles.rangeChipTextActive : styles.rangeChipText}>
                    {RANGE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Balance del periodo</Text>
              <Text style={styles.summaryValue}>{money(balance)}</Text>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summarySubLabel}>Ingresos</Text>
                  <Text style={styles.ingresoText}>{money(totalIngresos)}</Text>
                </View>
                <View>
                  <Text style={styles.summarySubLabel}>Egresos</Text>
                  <Text style={styles.egresoText}>{money(totalEgresos)}</Text>
                </View>
              </View>
            </View>

            {canExport ? (
            <View style={styles.exportRow}>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => handleExport(exportTransactionsToPdf)}
                disabled={exporting || filtered.length === 0}
              >
                <Text style={styles.exportButtonText}>Exportar PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => handleExport(exportTransactionsToExcel)}
                disabled={exporting || filtered.length === 0}
              >
                <Text style={styles.exportButtonText}>Exportar Excel</Text>
              </TouchableOpacity>
            </View>
            ) : (
              <TouchableOpacity style={styles.exportLocked} onPress={() => nav.go("upgrade")}>
                <Text style={styles.exportLockedText}>📄 Exporta tus reportes a PDF y Excel</Text>
                <Text style={styles.exportLockedBadge}>Pro</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>Movimientos del periodo ({filtered.length})</Text>

            {error && (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
                <TouchableOpacity style={styles.exportButton} onPress={retry}>
                  <Text style={styles.exportButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}
            {truncated && (
              <Text style={styles.emptyText}>
                Mostrando los últimos {ALL_LIMIT} movimientos. Elige un periodo más corto para ver un mes completo.
              </Text>
            )}
            {loading && <Text style={styles.emptyText}>Cargando...</Text>}
            {!loading && !error && filtered.length === 0 && (
              <Text style={styles.emptyText}>No hay movimientos en este periodo.</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View>
              <Text style={styles.txCategory}>{item.category}</Text>
              <Text style={styles.txMeta}>
                {item.date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
              </Text>
            </View>
            <Text style={item.type === "ingreso" ? styles.ingresoText : styles.egresoText}>
              {item.type === "ingreso" ? "+" : "-"}
              {money(item.amount)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  listContent: { padding: 20, paddingBottom: 60 },
  exportLocked: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  exportLockedText: { flex: 1, fontSize: 13, color: colors.ink },
  exportLockedBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.title,
    backgroundColor: colors.green100,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  rangeChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rangeChipActive: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  rangeChipText: { fontSize: 12, color: colors.ink },
  rangeChipTextActive: { fontSize: 12, color: colors.onNavy, fontWeight: "700" },
  summaryCard: { backgroundColor: colors.navy900, borderRadius: 16, padding: 20 },
  summaryLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  summaryValue: { color: colors.onNavy, fontSize: 26, fontWeight: "700", marginTop: 4 },
  summaryRow: { flexDirection: "row", gap: 24, marginTop: 18 },
  summarySubLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  ingresoText: { color: colors.green500, fontWeight: "600", fontSize: 14 },
  egresoText: { color: "#f0a89c", fontWeight: "600", fontSize: 14 },
  exportRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  exportButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  exportButtonText: { color: colors.title, fontWeight: "700", fontSize: 13 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 28,
    marginBottom: 10,
  },
  emptyText: { fontSize: 13, color: colors.inkSoft, textAlign: "center", paddingVertical: 20 },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  txCategory: { fontSize: 14, fontWeight: "600", color: colors.ink },
  txMeta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
}));
