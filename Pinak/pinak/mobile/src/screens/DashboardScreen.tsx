import { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthUser, logoutUser } from "../lib/auth";
import { computeBalance, useTransactions } from "../lib/transactions";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { AiQuickAddModal } from "../components/AiQuickAddModal";
import { AppHeader } from "../components/AppHeader";
import { colors } from "../theme";
import type { Transaction } from "../types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function DashboardScreen({
  onOpenReceivables,
  onOpenReports,
}: {
  onOpenReceivables: () => void;
  onOpenReports: () => void;
}) {
  const { user } = useAuthUser();
  const { transactions, loading } = useTransactions(user?.uid);
  const [showModal, setShowModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  if (!user) return null;

  const { balance, totalIngresos, totalEgresos } = computeBalance(transactions);
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
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Balance total</Text>
              <Text style={styles.balanceValue}>{currency.format(balance)}</Text>
              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceSubLabel}>Ingresos</Text>
                  <Text style={styles.ingresoText}>{currency.format(totalIngresos)}</Text>
                </View>
                <View>
                  <Text style={styles.balanceSubLabel}>Egresos</Text>
                  <Text style={styles.egresoText}>{currency.format(totalEgresos)}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.aiButton} onPress={() => setShowAiModal(true)}>
              <Text style={styles.aiButtonText}>✨ Registrar con IA (voz o texto)</Text>
            </TouchableOpacity>

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

            {loading && <Text style={styles.emptyText}>Cargando movimientos...</Text>}
            {!loading && recientes.length === 0 && (
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
        userId={user.uid}
        editingTransaction={editingTransaction}
        onClose={() => {
          setShowModal(false);
          setEditingTransaction(null);
        }}
      />

      <AiQuickAddModal
        visible={showAiModal}
        userId={user.uid}
        onClose={() => setShowAiModal(false)}
      />
    </View>
  );
}

function TransactionRow({ item, onPress }: { item: Transaction; onPress: () => void }) {
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
        {currency.format(item.amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  listContent: { padding: 20, paddingBottom: 60 },
  balanceCard: { backgroundColor: colors.navy900, borderRadius: 16, padding: 20 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  balanceValue: { color: colors.white, fontSize: 28, fontWeight: "700", marginTop: 4 },
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
  aiButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  primaryAction: {
    flex: 1,
    backgroundColor: colors.green600,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  primaryActionText: { color: colors.white, fontWeight: "700", fontSize: 12 },
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
  secondaryActionText: { color: colors.navy900, fontWeight: "700", fontSize: 12 },
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
});
