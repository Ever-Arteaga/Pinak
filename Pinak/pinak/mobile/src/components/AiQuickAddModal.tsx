import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { addTransaction } from "../lib/transactions";
import { parseTransactionText, type AiParsedTransaction } from "../lib/ai";
import { colors } from "../theme";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type Step = "input" | "preview";

export function AiQuickAddModal({
  visible,
  userId,
  onClose,
}: {
  visible: boolean;
  userId: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<AiParsedTransaction[]>([]);
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number | null } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("input");
    setText("");
    setCandidates([]);
    setUsageInfo(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAnalyze() {
    if (!text.trim()) return;
    setProcessing(true);
    setError(null);
    try {
      const result = await parseTransactionText(text.trim());
      if (result.transactions.length === 0) {
        setError(
          "No pude identificar ningún movimiento en ese mensaje. Intenta ser más específico (monto, si fue ingreso o gasto)."
        );
        return;
      }
      setCandidates(result.transactions);
      setUsageInfo(result.usage);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el mensaje.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        candidates.map((c) =>
          addTransaction(userId, {
            type: c.type,
            amount: c.amount,
            category: c.category,
            method: c.method,
            description: c.description,
          })
        )
      );
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function updateCandidate(index: number, patch: Partial<AiParsedTransaction>) {
    setCandidates((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCandidate(index: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === "input" ? "Registrar con IA" : "Confirma los movimientos"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {step === "input" && (
            <View>
              <Text style={styles.hint}>
                Cuéntame qué pasó. Puedes escribir o usar el micrófono de tu teclado para
                dictar. Ej: &ldquo;Vendí 60.000 en Nequi y gasté 15.000 en insumos en
                efectivo&rdquo;
              </Text>
              <TextInput
                style={styles.textarea}
                multiline
                numberOfLines={4}
                value={text}
                onChangeText={setText}
                placeholder="Escribe o dicta con el micrófono..."
                placeholderTextColor={colors.inkSoft}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[styles.primaryButton, (!text.trim() || processing) && styles.disabled]}
                onPress={handleAnalyze}
                disabled={!text.trim() || processing}
              >
                <Text style={styles.primaryButtonText}>
                  {processing ? "Analizando..." : "Analizar con IA"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "preview" && (
            <View>
              {usageInfo?.limit !== null && usageInfo && (
                <Text style={styles.usageText}>
                  Registros IA usados este mes: {usageInfo.used}/{usageInfo.limit}
                </Text>
              )}

              <ScrollView style={styles.candidateList}>
                {candidates.map((c, i) => (
                  <View key={i} style={styles.candidateCard}>
                    <View style={styles.candidateTop}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.candidateBadgeRow}>
                          <View
                            style={[
                              styles.badge,
                              c.type === "ingreso" ? styles.badgeIngreso : styles.badgeEgreso,
                            ]}
                          >
                            <Text
                              style={
                                c.type === "ingreso"
                                  ? styles.badgeTextIngreso
                                  : styles.badgeTextEgreso
                              }
                            >
                              {c.type === "ingreso" ? "Ingreso" : "Egreso"}
                            </Text>
                          </View>
                          <TextInput
                            style={styles.categoryInput}
                            value={c.category}
                            onChangeText={(v) => updateCandidate(i, { category: v })}
                          />
                        </View>
                        <Text style={styles.candidateMeta}>
                          {c.method.charAt(0).toUpperCase() + c.method.slice(1)}
                          {c.description ? ` · ${c.description}` : ""}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeCandidate(i)} hitSlop={8}>
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      value={String(c.amount)}
                      onChangeText={(v) => updateCandidate(i, { amount: Number(v) || 0 })}
                    />
                  </View>
                ))}

                {candidates.length === 0 && (
                  <Text style={styles.emptyText}>
                    Quitaste todos los movimientos detectados.
                  </Text>
                )}
              </ScrollView>

              {error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setStep("input")}
                  disabled={saving}
                >
                  <Text style={styles.secondaryButtonText}>Atrás</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.primaryButtonFlex,
                    (saving || candidates.length === 0) && styles.disabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={saving || candidates.length === 0}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving
                      ? "Guardando..."
                      : `Guardar ${candidates.length} ${
                          candidates.length === 1 ? "registro" : "registros"
                        }`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700", color: colors.navy900 },
  close: { fontSize: 16, color: colors.inkSoft },
  hint: { fontSize: 13, color: colors.inkSoft, marginBottom: 10, lineHeight: 18 },
  textarea: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    minHeight: 90,
    textAlignVertical: "top",
  },
  error: {
    color: colors.danger,
    backgroundColor: "#fdf0ee",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: colors.navy900,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  primaryButtonFlex: {
    flex: 1,
    backgroundColor: colors.navy900,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.6 },
  usageText: { fontSize: 12, color: colors.inkSoft, marginBottom: 10 },
  candidateList: { maxHeight: 320 },
  candidateCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  candidateTop: { flexDirection: "row", alignItems: "flex-start" },
  candidateBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeIngreso: { backgroundColor: colors.green100 },
  badgeEgreso: { backgroundColor: "#fdf0ee" },
  badgeTextIngreso: { color: colors.green600, fontSize: 11, fontWeight: "700" },
  badgeTextEgreso: { color: colors.danger, fontSize: 11, fontWeight: "700" },
  categoryInput: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink, padding: 0 },
  candidateMeta: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  removeText: { color: colors.inkSoft, fontSize: 14 },
  amountInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    color: colors.inkSoft,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.ink, fontWeight: "700", fontSize: 14 },
});
