import { useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { addReceivable, deleteReceivable, updateReceivable } from "../lib/receivables";
import type { Receivable } from "../types/pinak";
import { colors } from "../theme";

export function AddReceivableModal({
  visible,
  userId,
  editingReceivable,
  onClose,
}: {
  visible: boolean;
  userId: string;
  editingReceivable?: Receivable | null;
  onClose: () => void;
}) {
  const isEditing = Boolean(editingReceivable);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editingReceivable) {
      setClientName(editingReceivable.clientName);
      setClientPhone(editingReceivable.clientPhone ?? "");
      setAmount(String(editingReceivable.amount));
    } else {
      setClientName("");
      setClientPhone("");
      setAmount("");
    }
    setError(null);
  }, [visible, editingReceivable]);

  async function handleSave() {
    const numericAmount = Number(amount);
    if (!clientName || !numericAmount || numericAmount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { clientName, clientPhone, amount: numericAmount };
      if (isEditing && editingReceivable) {
        await updateReceivable(userId, editingReceivable.id, payload);
      } else {
        await addReceivable(userId, payload);
      }
      onClose();
    } catch (err) {
      console.error("Error al guardar fiado:", err);
      setError(err instanceof Error ? traducirError(err.message) : "No se pudo guardar el fiado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingReceivable) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReceivable(userId, editingReceivable.id);
      onClose();
    } catch (err) {
      console.error("Error al eliminar fiado:", err);
      setError(
        err instanceof Error ? traducirError(err.message) : "No se pudo eliminar el fiado."
      );
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    Alert.alert("¿Eliminar este fiado?", "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: handleDelete },
    ]);
  }

  const busy = saving || deleting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEditing ? "Editar fiado" : "Nuevo fiado"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nombre del cliente</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Ej. María Rodríguez"
            placeholderTextColor={colors.inkSoft}
          />

          <Text style={styles.label}>WhatsApp del cliente (opcional)</Text>
          <TextInput
            style={styles.input}
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="Ej. 3001234567"
            keyboardType="phone-pad"
            placeholderTextColor={colors.inkSoft}
          />

          <Text style={styles.label}>Monto adeudado</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="$0"
            keyboardType="numeric"
            placeholderTextColor={colors.inkSoft}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={busy}>
            <Text style={styles.saveButtonText}>
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar fiado"}
            </Text>
          </TouchableOpacity>

          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={busy}>
              <Text style={styles.deleteButtonText}>
                {deleting ? "Eliminando..." : "Eliminar fiado"}
              </Text>
            </TouchableOpacity>
          )}
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
  return "No se pudo guardar el fiado. Intenta de nuevo.";
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
  },
  deleteButtonText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
});
