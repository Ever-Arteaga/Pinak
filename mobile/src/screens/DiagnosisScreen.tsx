import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import { useBusinessGate } from "../components/BusinessGate";
import { Button, Card, CardTitle, ErrorText, Muted } from "../components/ui";
import { useBusiness } from "../lib/business";
import { generateDiagnosis } from "../lib/businessApi";
import { useDiagnosis } from "../lib/diagnosis";
import { monthIdOf, monthLabel, previousMonthId } from "../lib/months";
import { usePrivacy } from "../lib/privacy";
import { useNav } from "../nav";
import { colors, themedStyles } from "../theme";
import { PLAN_LIMITS } from "../types/pinak";

const MAX_GENERATIONS = 3;

function pct(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  return `${n > 0 ? "+" : ""}${n.toLocaleString("es-CO")} %`;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, tone === "bad" && { color: colors.danger }, tone === "good" && { color: colors.green600 }]}>{value}</Text>
    </View>
  );
}

export default function DiagnosisScreen({ onBack }: { onBack: () => void }) {
  const { business } = useBusiness();
  const { money, enabled: privacyEnabled } = usePrivacy();
  const nav = useNav();
  const current = monthIdOf(Date.now());
  const months = [current, previousMonthId(current)];
  const [month, setMonth] = useState(current);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const allowed = !!business && PLAN_LIMITS[business.plan].diagnosis;
  const { diagnosis, loading } = useDiagnosis(business?.id, month, allowed);

  useEffect(() => {
    setError(null);
    setRevealed(false);
  }, [month, business?.id]);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      await generateDiagnosis({ businessId: biz.id, month });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const s = diagnosis?.stats;
  const remaining = Math.max(0, MAX_GENERATIONS - (diagnosis?.generationCount ?? 0));
  const hideText = privacyEnabled && !revealed;

  return (
    <View style={styles.container}>
      <AppHeader onBack={onBack} backLabel="Dashboard" title="Diagnóstico financiero" />
      <ScrollView contentContainerStyle={styles.content}>
        {!allowed ? (
          <Card>
            <Text style={styles.emoji}>🩺</Text>
            <CardTitle>Diagnóstico financiero con IA</CardTitle>
            <Muted>
              Cada mes, la IA analiza tus ingresos, gastos y fiados, y te explica en lenguaje sencillo cómo le fue a tu negocio y qué puedes mejorar. Disponible en el plan Premium.
            </Muted>
            <Button label="Ver plan Premium" onPress={() => nav.go("upgrade")} />
          </Card>
        ) : (
          <>
            <View style={styles.months}>
              {months.map((m) => (
                <TouchableOpacity key={m} onPress={() => setMonth(m)} style={[styles.month, m === month && styles.monthActive]}>
                  <Text style={[styles.monthText, m === month && styles.monthTextActive]}>{monthLabel(m)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <Muted style={{ textAlign: "center", marginTop: 20 }}>Cargando...</Muted>
            ) : !diagnosis || !s ? (
              <Card style={{ marginTop: 12 }}>
                <Text style={styles.emoji}>🩺</Text>
                <CardTitle>Diagnóstico de {monthLabel(month)}</CardTitle>
                <Muted>Analizamos los movimientos y fiados de este mes en {biz.name} y te contamos qué está pasando y qué hacer. Toma unos segundos.</Muted>
                <ErrorText>{error}</ErrorText>
                <Button label={generating ? "Analizando tu negocio..." : "Generar diagnóstico"} onPress={generate} disabled={generating} />
              </Card>
            ) : (
              <>
                <View style={styles.kpis}>
                  <Kpi label="Ingresos" value={money(s.income)} />
                  <Kpi label="Egresos" value={money(s.expenses)} />
                  <Kpi label="Balance" value={money(s.balance)} tone={s.balance >= 0 ? "good" : "bad"} />
                  <Kpi
                    label="Margen"
                    value={privacyEnabled ? "••••" : s.marginPct === null ? "—" : `${s.marginPct} %`}
                    tone={s.marginPct !== null && s.marginPct < 0 ? "bad" : undefined}
                  />
                </View>

                {s.change && !privacyEnabled && (
                  <Muted style={{ marginTop: 10 }}>
                    Frente a {monthLabel(previousMonthId(month))}: {pct(s.change.incomePct) ? `ingresos ${pct(s.change.incomePct)}` : "ingresos sin comparación"}
                    {" · "}
                    {pct(s.change.expensesPct) ? `egresos ${pct(s.change.expensesPct)}` : "egresos sin comparación"}
                  </Muted>
                )}

                {hideText ? (
                  <Card style={{ marginTop: 12 }}>
                    <Muted>El análisis puede mencionar montos, así que está oculto por tu modo privacidad.</Muted>
                    <Button label="Mostrar análisis" kind="ghost" onPress={() => setRevealed(true)} />
                  </Card>
                ) : (
                  <>
                    {diagnosis.alerta && (
                      <View style={styles.alert}>
                        <Text style={styles.alertTitle}>⚠️ Atención</Text>
                        <Text style={styles.body}>{diagnosis.alerta}</Text>
                      </View>
                    )}
                    <Card style={{ marginTop: 12 }}>
                      <CardTitle>Resumen</CardTitle>
                      <Text style={styles.body}>{diagnosis.resumen}</Text>
                    </Card>
                    {diagnosis.hallazgos.length > 0 && (
                      <Card>
                        <CardTitle>Lo que encontramos</CardTitle>
                        {diagnosis.hallazgos.map((h, i) => (
                          <Text key={i} style={[styles.body, { marginTop: 6 }]}>• {h}</Text>
                        ))}
                      </Card>
                    )}
                    {diagnosis.recomendaciones.length > 0 && (
                      <View style={styles.reco}>
                        <CardTitle>Qué puedes hacer</CardTitle>
                        {diagnosis.recomendaciones.map((r, i) => (
                          <Text key={i} style={[styles.recoText, { marginTop: 6 }]}>{i + 1}. {r}</Text>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {s.topExpenseCategories.length > 0 && (
                  <Card style={{ marginTop: 12 }}>
                    <CardTitle>En qué se va tu dinero</CardTitle>
                    {s.topExpenseCategories.map((c) => (
                      <View key={c.category} style={{ marginTop: 10 }}>
                        <View style={styles.catRow}>
                          <Text style={styles.body}>{c.category}</Text>
                          <Muted>{money(c.amount)} · {c.pct} %</Muted>
                        </View>
                        <View style={styles.barBg}>
                          <View style={[styles.bar, { width: `${Math.min(100, c.pct)}%` }]} />
                        </View>
                      </View>
                    ))}
                  </Card>
                )}

                <Muted style={{ textAlign: "center", marginTop: 14 }}>
                  {diagnosis.generatedAt ? `Generado el ${diagnosis.generatedAt.toLocaleDateString("es-CO", { day: "numeric", month: "long" })} · ` : ""}
                  {remaining > 0 ? `Puedes actualizarlo ${remaining} ${remaining === 1 ? "vez" : "veces"} más este mes.` : "Ya usaste las actualizaciones de este mes."}
                </Muted>
                {remaining > 0 && (
                  <>
                    <ErrorText>{error}</ErrorText>
                    <Button label={generating ? "Analizando..." : "Actualizar diagnóstico"} kind="ghost" onPress={generate} disabled={generating} />
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    content: { padding: 16, paddingBottom: 60 },
    emoji: { fontSize: 32, textAlign: "center", marginBottom: 6 },
    months: { flexDirection: "row", gap: 8 },
    month: { flex: 1, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
    monthActive: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
    monthText: { color: colors.title, fontWeight: "600", fontSize: 13, textTransform: "capitalize" },
    monthTextActive: { color: colors.onNavy },
    kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
    kpi: { width: "48%", flexGrow: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12 },
    kpiLabel: { fontSize: 12, color: colors.inkSoft },
    kpiValue: { fontSize: 16, fontWeight: "700", color: colors.title, marginTop: 2 },
    alert: { marginTop: 12, backgroundColor: "#fdf0ee", borderWidth: 1, borderColor: "#f3c5bd", borderRadius: 14, padding: 14 },
    alertTitle: { color: colors.danger, fontWeight: "700", fontSize: 13, marginBottom: 4 },
    body: { fontSize: 13.5, lineHeight: 20, color: colors.ink },
    reco: { marginTop: 12, backgroundColor: colors.green100, borderWidth: 1, borderColor: colors.green600, borderRadius: 14, padding: 16 },
    recoText: { fontSize: 13.5, lineHeight: 20, color: colors.title },
    catRow: { flexDirection: "row", justifyContent: "space-between" },
    barBg: { height: 6, borderRadius: 3, backgroundColor: colors.cream, marginTop: 4, overflow: "hidden" },
    bar: { height: 6, borderRadius: 3, backgroundColor: colors.navy900 },
  })
);
