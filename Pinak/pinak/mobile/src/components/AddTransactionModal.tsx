import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { addTransaction, deleteTransaction, updateTransaction } from "../lib/transactions";
import { addCategory, useCategories } from "../lib/categories";
import type { PaymentMethod, Transaction, TransactionType } from "../types/pinak";
import { colors } from "../theme";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

const MAX_SHEET_HEIGHT = Dimensions.get("window").height * 0.85;

export function AddTransactionModal({
  visible,
  userId,
  editingTransaction,
  onClose,
}: {
  visible: boolean;
  userId: string;
  editingTransaction?: Transaction | null;
  onClose: () => void;
}) {
  const isEditing = Boolean(editingTransaction);

  const [type, setType] = useState<TransactionType>("ingreso");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { categories } = useCategories(userId);
  const categoriesForType = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!visible) return;
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(String(editingTransaction.amount));
      setCategory(editingTransaction.category);
      setMethod(editingTransaction.method);
    } else {
      setType("ingreso");
      setAmount("");
      setCategory("");
      setMethod("efectivo");
    }
    setAddingCustom(false);
    setCustomCategory("");
    setError(null);
  }, [visible, editingTransaction]);

  async function handleSave() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    const finalCategory = addingCustom ? customCategory.trim() : category;
    if (!finalCategory) return;

    setSaving(true);
    setError(null);
    try {
      const alreadyExists = categoriesForType.some(
        (c) => c.name.toLowerCase() === finalCategory.toLowerCase()
      );
      if (addingCustom && !alreadyExists) {
        await addCategory(userId, finalCategory, type);
      }

      const payload = { type, amount: numericAmount, category: finalCategory, method };
      if (isEditing && editingTransaction) {
        await updateTransaction(userId, editingTransaction.id, payload);
      } else {
        await addTransaction(userId, payload);
      }
      onClose();
    } catch (err) {
      console.error("Error al guardar transacción:", err);
      setError(
        err instanceof Error ? traducirError(err.message) : "No se pudo guardar el registro."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingTransaction) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTransaction(userId, editingTransaction.id);
      onClose();
    } catch (err) {
      console.error("Error al eliminar transacción:", err);
      setError(
        err instanceof Error ? traducirError(err.message) : "No se pudo eliminar el registro."
      );
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "¿Eliminar este registro?",
      "Esta acción no se puede deshacer. El movimiento se borrará de tu historial.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: handleDelete },
      ]
    );
  }

  const busy = saving || deleting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { maxHeight: MAX_SHEET_HEIGHT }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEditing ? "Editar registro" : "Nuevo registro"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, type === "ingreso" && styles.tabActiveIngreso]}
                onPress={() => {
                  setType("ingreso");
                  setCategory("");
                  setAddingCustom(false);
                }}
              >
                <Text style={type === "ingreso" ? styles.tabTextActiveIngreso : styles.tabText}>
                  Ingreso
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, type === "egreso" && styles.tabActiveEgreso]}
                onPress={() => {
                  setType("egreso");
                  setCategory("");
                  setAddingCustom(false);
                }}
              >
                <Text style={type === "egreso" ? styles.tabTextActiveEgreso : styles.tabText}>
                  Egreso
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="$0"
              placeholderTextColor={colors.inkSoft}
            />

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.methodRow}>
              {categoriesForType.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.methodChip,
                    category === c.name && !addingCustom && styles.methodChipActive,
                  ]}
                  onPress={() => {
                    setCategory(c.name);
                    setAddingCustom(false);
                  }}
                >
                  <Text
                    style={
                      category === c.name && !addingCustom
                        ? styles.methodChipTextActive
                        : styles.methodChipText
                    }
                  >
                    {c.icon} {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.methodChip, styles.addChip, addingCustom && styles.methodChipActive]}
                onPress={() => {
                  setAddingCustom(true);
                  setCategory("");
                }}
              >
                <Text style={addingCustom ? styles.methodChipTextActive : styles.methodChipText}>
                  + Otra
                </Text>
              </TouchableOpacity>
            </View>
            {addingCustom && (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholder="Nombre de la categoría"
                placeholderTextColor={colors.inkSoft}
              />
            )}

            <Text style={styles.label}>Método</Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.methodChip, method === m.value && styles.methodChipActive]}
                  onPress={() => setMethod(m.value)}
                >
                  <Text
                    style={method === m.value ? styles.methodChipTextActive : styles.methodChipText}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={busy}>
              <Text style={styles.saveButtonText}>
                {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar registro"}
              </Text>
            </TouchableOpacity>

            {isEditing && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={confirmDelete}
                disabled={busy}
              >
                <Text style={styles.deleteButtonText}>
                  {deleting ? "Eliminando..." : "Eliminar registro"}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function traducirError(message: string): string {
  if (message.includes("permission-denied"))
    return "No tienes permiso para guardar (revisa las reglas de Firestore).";
  if (message.includes("unauthenticated"))
    return "Tu sesión expiró, vuelve a iniciar sesión.";
  if (message.includes("unavailable"))
    return "Sin conexión con el servidor. Intenta de nuevo.";
  return "No se pudo guardar el registro. Intenta de nuevo.";
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 17, fontWeight: "700", color: colors.navy900 },
  close: { fontSize: 16, color: colors.inkSoft },
  error: {
    color: colors.danger,
    backgroundColor: "#fdf0ee",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginTop: 12,
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActiveIngreso: { backgroundColor: colors.green100 },
  tabActiveEgreso: { backgroundColor: "#fdf0ee" },
  tabText: { color: colors.inkSoft, fontWeight: "600", fontSize: 13 },
  tabTextActiveIngreso: { color: colors.green600, fontWeight: "700", fontSize: 13 },
  tabTextActiveEgreso: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addChip: { borderStyle: "dashed" },
  methodChipActive: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  methodChipText: { fontSize: 12, color: colors.ink },
  methodChipTextActive: { fontSize: 12, color: colors.white, fontWeight: "600" },
  saveButton: {
    backgroundColor: colors.navy900,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  deleteButtonText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
});
