import { useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthUser } from "../lib/auth";
import {
  markReceivableAsPaid,
  openWhatsAppCollection,
  useReceivables,
} from "../lib/receivables";
import { AddReceivableModal } from "../components/AddReceivableModal";
import { AppHeader } from "../components/AppHeader";
import { colors } from "../theme";
import type { Receivable } from "../types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function ReceivablesScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuthUser();
  const { receivables, loading } = useReceivables(user?.uid);
  const [showModal, setShowModal] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);

  if (!user) return null;

  const pendientes = receivables.filter((r) => r.status !== "pagado");
  const totalPendiente = pendientes.reduce((sum, r) => sum + r.amount, 0);
  const businessName = user.displayName || "tu negocio";

  return (
    <View style={styles.container}>
      <AppHeader onBack={onBack} backLabel="Dashboard" title="Fiados" />

      <FlatList
        data={receivables}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total por cobrar</Text>
              <Text style={styles.summaryValue}>{currency.format(totalPendiente)}</Text>
              <Text style={styles.summarySub}>
                {pendientes.length} {pendientes.length === 1 ? "fiado pendiente" : "fiados pendientes"}
              </Text>
            </View>

            <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
              <Text style={styles.addButtonText}>+ Nuevo fiado</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Cuentas por cobrar</Text>

            {loading && <Text style={styles.emptyText}>Cargando fiados...</Text>}
            {!loading && receivables.length === 0 && (
              <Text style={styles.emptyText}>
                Sin fiados registrados. Cuando un cliente te deba, regístralo aquí.
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <ReceivableRow
            item={item}
            onEdit={() => setEditingReceivable(item)}
            onMarkPaid={() => markReceivableAsPaid(user.uid, item.id)}
            onCollect={() => openWhatsAppCollection(businessName, item)}
          />
        )}
      />

      <AddReceivableModal
        visible={showModal || Boolean(editingReceivable)}
        userId={user.uid}
        editingReceivable={editingReceivable}
        onClose={() => {
          setShowModal(false);
          setEditingReceivable(null);
        }}
      />
    </View>
  );
}

function ReceivableRow({
  item,
  onEdit,
  onMarkPaid,
  onCollect,
}: {
  item: Receivable;
  onEdit: () => void;
  onMarkPaid: () => void;
  onCollect: () => void;
}) {
  const isPaid = item.status === "pagado";

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardTop} onPress={onEdit} activeOpacity={0.7}>
        <View>
          <Text style={styles.clientName}>{item.clientName}</Text>
          <Text style={styles.status}>{isPaid ? "Pagado" : "Pendiente"}</Text>
        </View>
        <Text style={[styles.amount, isPaid && styles.amountPaid]}>
          {currency.format(item.amount)}
        </Text>
      </TouchableOpacity>

      {!isPaid && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.whatsappButton} onPress={onCollect}>
            <Text style={styles.whatsappButtonText}>Cobrar por WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onMarkPaid}>
            <Text style={styles.secondaryButtonText}>Pagado</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  listContent: { padding: 20, paddingBottom: 60 },
  summaryCard: { backgroundColor: colors.navy900, borderRadius: 16, padding: 20 },
  summaryLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  summaryValue: { color: colors.white, fontSize: 26, fontWeight: "700", marginTop: 4 },
  summarySub: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 8 },
  addButton: {
    backgroundColor: colors.green600,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  addButtonText: { color: colors.white, fontWeight: "700", fontSize: 13 },
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
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  clientName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  status: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "700", color: colors.navy900 },
  amountPaid: { color: colors.inkSoft, textDecorationLine: "line-through" },
  actionsRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  whatsappButton: {
    flex: 1,
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  whatsappButtonText: { color: colors.white, fontWeight: "700", fontSize: 12 },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.navy900, fontWeight: "700", fontSize: 12 },
});
