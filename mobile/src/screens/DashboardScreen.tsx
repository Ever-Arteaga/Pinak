import { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { logoutUser } from "../lib/auth";
import { useBusiness } from "../lib/business";
import { usePrivacy } from "../lib/privacy";
import { useBusinessGate } from "../components/BusinessGate";
import { InvitationsBanner } from "../components/InvitationsBanner";
import { useTransactions } from "../lib/transactions";
import { useAllTimeSummary } from "../lib/summaries";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { AiQuickAddModal } from "../components/AiQuickAddModal";
import { AppHeader } from "../components/AppHeader";
import { colors, themedStyles } from "../theme";
import { PLAN_LIMITS, type Transaction } from "../types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function DashboardScreen({
  onOpenReceivables,
  onOpenReports,
  onOpenUpgrade,
}: {
  onOpenReceivables: () => void;
  onOpenReports: () => void;
  onOpenUpgrade: () => void;
}) {
  const { business } = useBusiness();
  const { money } = usePrivacy();
  // Los totales salen de un resumen; solo se escuchan los 20 movimientos más recientes.
  const { transactions, loading, error: txError, retry: retryTx } = useTransactions(business?.id, { limit: 20 });
  const { summary: totales, error: totalesError, retry: retryTotales } = useAllTimeSummary(business?.id);
  const [showModal, setShowModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  const totalIngresos = totales.income;
  const totalEgresos = totales.expense;
  const balance = totalIngresos - totalEgresos;
  const recientes = transactions.slice(0, 8);

  return (
    <View style={styles.container}>
      <AppHeader onLogout={() => logoutUser()} />

      <FlatList
        data={recientes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.bizTitle}>{biz.name}</Text>
            <InvitationsBanner />
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Balance total</Text>
              <Text style={styles.balanceValue}>{money(balance)}</Text>
              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceSubLabel}>Ingresos</Text>
                  <Text style={styles.ingresoText}>{money(totalIngresos)}</Text>
                </View>
                <View>
                  <Text style={styles.balanceSubLabel}>Egresos</Text>
                  <Text style={styles.egresoText}>{money(totalEgresos)}</Text>
                </View>
              </View>
            </View>

            {PLAN_LIMITS[biz.plan].aiEnabled && (
              <TouchableOpacity style={styles.aiButton} onPress={() => setShowAiModal(true)}>
                <Text style={styles.aiButtonText}>✨ Registrar con IA (voz o texto)</Text>
              </TouchableOpacity>
            )}

            {!PLAN_LIMITS[biz.plan].aiEnabled && (
              <TouchableOpacity style={styles.upsellBanner} onPress={onOpenUpgrade}>
                <Text style={styles.upsellText}>
                  ✨ Registra ventas hablando o escribiendo con IA
                </Text>
                <Text style={styles.upsellLink}>Actualizar →</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => setShowModal(true)}
              >
                <Text style={styles.primaryActionText}>+ Nuevo registro</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={onOpenReceivables}
              >
                <Text style={styles.secondaryActionText}>Ver fiados</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={onOpenReports}
              >
                <Text style={styles.secondaryActionText}>Reportes</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Movimientos recientes</Text>

            {(txError || totalesError) && (
              <View style={{ alignItems: "center", paddingVertical: 16 }}>
                <Text style={[styles.emptyText, { color: colors.danger }]}>{txError ?? totalesError}</Text>
                <TouchableOpacity
                  onPress={() => {
                    retryTx();
                    retryTotales();
                  }}
                  style={styles.secondaryAction}
                >
                  <Text style={styles.secondaryActionText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}
            {loading && <Text style={styles.emptyText}>Cargando movimientos...</Text>}
            {!loading && !txError && recientes.length === 0 && (
              <Text style={styles.emptyText}>
                Aún no tienes registros. Agrega tu primer ingreso o egreso.
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TransactionRow item={item} onPress={() => setEditingTransaction(item)} />
        )}
      />

      <AddTransactionModal
        visible={showModal || Boolean(editingTransaction)}
        businessId={biz.id}
        editingTransaction={editingTransaction}
        onClose={() => {
          setShowModal(false);
          setEditingTransaction(null);
        }}
      />

      <AiQuickAddModal
        visible={showAiModal}
        businessId={biz.id}
        onClose={() => setShowAiModal(false)}
      />
    </View>
  );
}

function TransactionRow({ item, onPress }: { item: Transaction; onPress: () => void }) {
  const { money } = usePrivacy();
  return (
    <TouchableOpacity style={styles.txRow} onPress={onPress} activeOpacity={0.7}>
      <View>
        <Text style={styles.txCategory}>{item.category}</Text>
        <Text style={styles.txMeta}>
          {item.method.charAt(0).toUpperCase() + item.method.slice(1)} ·{" "}
          {item.date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
        </Text>
      </View>
      <Text style={item.type === "ingreso" ? styles.ingresoText : styles.egresoText}>
        {item.type === "ingreso" ? "+" : "-"}
        {money(item.amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  listContent: { padding: 20, paddingBottom: 60 },
  bizTitle: { fontSize: 13, fontWeight: "700", color: colors.inkSoft, marginBottom: 8 },
  balanceCard: { backgroundColor: colors.navy900, borderRadius: 16, padding: 20 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  balanceValue: { color: colors.onNavy, fontSize: 28, fontWeight: "700", marginTop: 4 },
  balanceRow: { flexDirection: "row", gap: 24, marginTop: 18 },
  balanceSubLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  ingresoText: { color: colors.green500, fontWeight: "600", fontSize: 14 },
  egresoText: { color: "#f0a89c", fontWeight: "600", fontSize: 14 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  aiButton: {
    backgroundColor: colors.navy900,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  aiButtonText: { color: colors.onNavy, fontWeight: "700", fontSize: 14 },
  upsellBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  upsellText: { flex: 1, fontSize: 12.5, color: colors.ink, marginRight: 8 },
  upsellLink: { fontSize: 12.5, fontWeight: "700", color: colors.title },
  primaryAction: {
    flex: 1,
    backgroundColor: colors.green600,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  primaryActionText: { color: colors.onNavy, fontWeight: "700", fontSize: 12 },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  secondaryActionText: { color: colors.title, fontWeight: "700", fontSize: 12 },
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
