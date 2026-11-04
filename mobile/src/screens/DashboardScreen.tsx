import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  deltaTone,
  formatCompactCOP,
  formatPctChange,
  formatPoints,
  methodLabel,
  relativeTime,
  sourceLabel,
} from "@pinak/shared/dashboard";
import { logoutUser } from "../lib/auth";
import { useBusiness } from "../lib/business";
import { usePrivacy } from "../lib/privacy";
import { useDashboard, type DashboardPeriod } from "../lib/dashboard";
import { openWhatsAppCollection } from "../lib/receivables";
import { useBusinessGate } from "../components/BusinessGate";
import { InvitationsBanner } from "../components/InvitationsBanner";
import { ExpiryBanner } from "../components/ExpiryBanner";
import { AddTransactionModal } from "../components/AddTransactionModal";
import { AiQuickAddModal } from "../components/AiQuickAddModal";
import { AppHeader } from "../components/AppHeader";
import { useNav } from "../nav";
import { colors, themedStyles } from "../theme";
import { PLAN_LIMITS, type Transaction } from "../types/pinak";

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "12m", label: "12 meses" },
];
const PERIOD_TEXT: Record<DashboardPeriod, string> = { "7d": "7 días", "30d": "30 días", "12m": "12 meses" };
const EXAMPLES_PERSONAL = ["Me pagaron 1.200.000 de salario", "Gasté 80.000 en mercado con Nequi", "Pagué 45.000 de transporte en efectivo"];
const EXAMPLES = ["Vendí 60.000 en Nequi", "Gasté 15.000 en insumos en efectivo", "Me pagaron 120.000 en efectivo"];
const BAR_ZONE = 140;

type Filter = "todos" | "ingreso" | "egreso";

function tint(metric: "income" | "expense" | "balance" | "margin", v: number | null) {
  const t = deltaTone(metric, v);
  return t === "good" ? colors.green600 : t === "bad" ? colors.danger : colors.inkSoft;
}

/** Variación con flecha y signo: el color nunca es la única señal. */
function DeltaText({ metric, value, kind = "pct", onDark }: { metric: "income" | "expense" | "balance" | "margin"; value: number | null; kind?: "pct" | "points"; onDark?: boolean }) {
  const text = kind === "points" ? formatPoints(value) : formatPctChange(value);
  const arrow = value === null || value === 0 ? "•" : value > 0 ? "▲" : "▼";
  return (
    <Text style={[styles.delta, { color: onDark ? "#fff" : tint(metric, value) }]}>
      {arrow} {text}
    </Text>
  );
}

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
  const { money, available, enabled, toggle } = usePrivacy();
  const { addSignal } = useNav();
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const dash = useDashboard(business?.id, period);
  const [manual, setManual] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [aiText, setAiText] = useState<string | undefined>(undefined);
  const [sheetText, setSheetText] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [selected, setSelected] = useState<number | null>(null);

  // El botón "+" de la barra inferior abre la hoja de registro.
  const lastSignal = useRef(addSignal);
  useEffect(() => {
    if (addSignal !== lastSignal.current) {
      lastSignal.current = addSignal;
      setSheet(true);
    }
  }, [addSignal]);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;
  const aiOn = PLAN_LIMITS[biz.plan].aiEnabled;
  const personal = biz.plan === "essential";
  const examples = personal ? EXAMPLES_PERSONAL : EXAMPLES;
  const { data, receivables, recent } = dash;
  const t = data.totals;
  const c = data.comparison;
  const hasSeries = data.series.length > 0;
  const sel = hasSeries ? Math.min(selected ?? data.series.length - 1, data.series.length - 1) : 0;
  const point = hasSeries ? data.series[sel] : null;
  const maxVal = Math.max(1, ...data.series.map((s) => Math.max(s.income, s.expense)));
  const recientes = recent.filter((r) => filter === "todos" || r.type === filter).slice(0, 5);
  const today = new Date(dash.nowMs).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" });
  const everyN = data.series.length > 14 ? 5 : 1;

  function openAi() {
    if (!aiOn) return onOpenUpgrade();
    setSheet(true);
  }
  function detect(text: string) {
    setSheet(false);
    setAiText(text);
    setSheetText("");
  }

  return (
    <View style={styles.container}>
      <AppHeader onLogout={() => logoutUser()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.date}>{today}</Text>
            <Text style={styles.biz} numberOfLines={1}>{biz.name}</Text>
          </View>
          {available && (
            <TouchableOpacity style={styles.eye} onPress={() => toggle()} accessibilityLabel={enabled ? "Mostrar montos" : "Ocultar montos"}>
              <Text style={{ fontSize: 18 }}>{enabled ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          )}
        </View>

        <InvitationsBanner />
        <ExpiryBanner />

        <View style={styles.segment} accessibilityRole="tablist">
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.segBtn, period === p.id && styles.segActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === p.id }}
              onPress={() => { setPeriod(p.id); setSelected(null); }}
            >
              <Text style={[styles.segText, period === p.id && styles.segTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {dash.error && (
          <View style={styles.card}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>{dash.error}</Text>
            <TouchableOpacity style={styles.ghost} onPress={dash.retry}><Text style={styles.ghostText}>Reintentar</Text></TouchableOpacity>
          </View>
        )}

        {/* Balance */}
        <View style={styles.balance}>
          <Text style={styles.balLabel}>Balance · últimos {PERIOD_TEXT[period]}</Text>
          <Text style={styles.balValue}>{money(t.balance)}</Text>
          <View style={styles.balPill}>
            <DeltaText metric="balance" value={c.balancePct} onDark />
            <Text style={styles.balVs}> vs. {PERIOD_TEXT[period]} anteriores</Text>
          </View>
          <View style={styles.balRow}>
            <View style={styles.balBox}>
              <Text style={styles.balSub}>Ingresos</Text>
              <Text style={styles.balNum}>{money(t.income)}</Text>
              <DeltaText metric="income" value={c.incomePct} onDark />
            </View>
            <View style={styles.balBox}>
              <Text style={styles.balSub}>Egresos</Text>
              <Text style={styles.balNum}>{money(t.expense)}</Text>
              <DeltaText metric="expense" value={c.expensePct} onDark />
            </View>
          </View>
        </View>

        {/* IA */}
        <TouchableOpacity style={styles.aiCard} onPress={openAi} accessibilityRole="button">
          <Text style={styles.aiMic}>🎙️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Registrar con IA {aiOn ? "" : "🔒"}</Text>
            <Text style={styles.aiSub} numberOfLines={2}>
              {aiOn ? (personal ? "“Me pagaron 1.200.000 de salario y gasté 80.000 en mercado”" : "“Vendí 60.000 en Nequi y gasté 15.000 en insumos”") : "Disponible en los planes Essential, Pro y Premium. Toca para mejorar tu plan."}
            </Text>
          </View>
        </TouchableOpacity>

        {/* KPIs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpis}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Margen</Text>
            <Text style={styles.kpiValue}>{t.marginPct === null ? "—" : `${t.marginPct.toFixed(1).replace(".", ",")} %`}</Text>
            <DeltaText metric="margin" value={c.marginPts} kind="points" />
          </View>
          <TouchableOpacity style={styles.kpi} onPress={onOpenReceivables}>
            <Text style={styles.kpiLabel}>Por cobrar</Text>
            <Text style={styles.kpiValue}>{money(receivables.totalPending)}</Text>
            <Text style={[styles.kpiNote, receivables.overdueCount > 0 && { color: colors.danger }]}>
              {receivables.overdueCount > 0 ? `⚠ ${receivables.overdueCount} vencido${receivables.overdueCount === 1 ? "" : "s"}` : `${receivables.pendingCount} pendientes`}
            </Text>
          </TouchableOpacity>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Movimientos</Text>
            <Text style={styles.kpiValue}>{t.count}</Text>
            <Text style={styles.kpiNote}>{t.aiCount} con IA</Text>
          </View>
        </ScrollView>

        {dash.loading && !hasSeries ? (
          <View style={[styles.card, { height: 200, opacity: 0.5 }]} accessibilityLabel="Cargando" />
        ) : data.isEmpty ? (
          <View style={[styles.card, { alignItems: "center", paddingVertical: 28 }]}>
            <Text style={{ fontSize: 32 }}>🌱</Text>
            <Text style={styles.cardTitle}>Aún no tienes registros</Text>
            <Text style={[styles.muted, { textAlign: "center", marginBottom: 12 }]}>Registra tu primera venta o gasto y aquí verás tu flujo de caja.</Text>
            <TouchableOpacity style={styles.primary} onPress={() => setManual(true)}>
              <Text style={styles.primaryText}>Registrar mi primer movimiento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Flujo de caja */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Flujo de caja</Text>
              {point && (
                <Text style={styles.strip} accessibilityLiveRegion="polite">
                  {point.fullLabel} · ▲ {money(point.income)} · ▼ {money(point.expense)} · Neto {money(point.income - point.expense)}
                </Text>
              )}
              <View style={styles.chart}>
                {data.series.map((s, i) => (
                  <Pressable
                    key={s.key}
                    style={[styles.barCol, i === sel && styles.barSel]}
                    onPress={() => setSelected(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: i === sel }}
                    accessibilityLabel={`${s.fullLabel}: ingresos ${s.income} pesos, egresos ${s.expense} pesos`}
                  >
                    <View style={styles.barPair}>
                      <View style={[styles.bar, { backgroundColor: colors.green600, height: Math.max(2, (s.income / maxVal) * BAR_ZONE) }]} />
                      <View style={[styles.bar, { backgroundColor: colors.danger, opacity: 0.6, height: Math.max(2, (s.expense / maxVal) * BAR_ZONE) }]} />
                    </View>
                    <Text style={[styles.barLabel, i === sel && { fontWeight: "700", color: colors.title }]} numberOfLines={1}>
                      {i % everyN === 0 || i === sel ? s.shortLabel : " "}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.muted}>Eje: hasta {formatCompactCOP(maxVal)}. Toca una barra para ver el detalle.</Text>
              <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
                <Text style={styles.legend}>■ Ingresos</Text>
                <Text style={[styles.legend, { color: colors.danger }]}>■ Egresos</Text>
              </View>
            </View>

            {/* Egresos por categoría */}
            {data.expenseByCategory.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>¿En qué se va la plata?</Text>
                {data.expenseByCategory.slice(0, 4).map((s, i) => (
                  <View key={s.name} style={{ marginBottom: 10 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.catName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.catAmt}>{money(s.amount)} · {Math.round(s.pct)} %</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={{ width: `${Math.max(2, s.pct)}%`, height: 8, borderRadius: 4, backgroundColor: colors.danger, opacity: i === 0 ? 1 : 0.55 }} />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Fiados */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Fiados por cobrar</Text>
            <TouchableOpacity onPress={onOpenReceivables} hitSlop={8}><Text style={styles.link}>Ver todos →</Text></TouchableOpacity>
          </View>
          {receivables.top.length === 0 && <Text style={styles.muted}>No tienes fiados pendientes. 🎉</Text>}
          {receivables.top.map((r) => (
            <View key={r.id} style={styles.fiado}>
              <View style={{ flex: 1 }}>
                <Text style={styles.catName} numberOfLines={1}>{r.clientName}</Text>
                <Text style={[styles.muted, r.overdue && { color: colors.danger }]}>
                  {r.overdue ? "⚠ Vencido" : r.dueDate ? `Vence ${r.dueDate.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}` : "Sin fecha"}
                </Text>
              </View>
              <Text style={styles.catAmt}>{money(r.amount)}</Text>
              {r.clientPhone ? (
                <TouchableOpacity style={styles.cobrar} onPress={() => openWhatsAppCollection(biz.name, r, personal)} accessibilityLabel={`Cobrar a ${r.clientName} por WhatsApp`}>
                  <Text style={styles.ghostText}>Cobrar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>

        {/* Movimientos recientes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Movimientos recientes</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            {(["todos", "ingreso", "egreso"] as Filter[]).map((f) => (
              <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipOn]} onPress={() => setFilter(f)} accessibilityState={{ selected: filter === f }}>
                <Text style={[styles.chipText, filter === f && { color: "#fff" }]}>{f === "todos" ? "Todos" : f === "ingreso" ? "Ingresos" : "Egresos"}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {recientes.length === 0 && <Text style={styles.muted}>Sin movimientos para mostrar.</Text>}
          {recientes.map((r) => (
            <TouchableOpacity key={r.id} style={styles.tx} onPress={() => setEditing(r)}>
              <Text style={[styles.txArrow, { color: r.type === "ingreso" ? colors.green600 : colors.danger }]}>{r.type === "ingreso" ? "↗" : "↙"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.catName} numberOfLines={1}>{r.category}</Text>
                <Text style={styles.muted}>{methodLabel(r.method)} · {relativeTime(r.date.getTime(), dash.nowMs)} · {sourceLabel(r.source)}</Text>
              </View>
              <Text style={[styles.catAmt, { color: r.type === "ingreso" ? colors.green600 : colors.danger }]}>
                {r.type === "ingreso" ? "+" : "-"}{money(r.amount)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={{ alignItems: "center", paddingTop: 10, minHeight: 44, justifyContent: "center" }} onPress={onOpenReports}>
            <Text style={styles.link}>Ver todos los movimientos →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Hoja de registro */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)} />
        <View style={styles.sheet}>
          <Text style={styles.cardTitle}>Registrar movimiento</Text>
          {aiOn ? (
            <>
              <TextInput
                style={styles.input}
                value={sheetText}
                onChangeText={setSheetText}
                placeholder={personal ? "Ej.: Gasté 80.000 en mercado…" : "Ej.: Vendí 60.000 en Nequi…"}
                placeholderTextColor={colors.inkSoft}
                multiline
              />
              <Text style={styles.muted}>Para dictar, usa el micrófono de tu teclado.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 }}>
                {examples.map((e) => (
                  <TouchableOpacity key={e} style={styles.chip} onPress={() => setSheetText(e)}>
                    <Text style={styles.chipText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.primary, !sheetText.trim() && { opacity: 0.5 }]} disabled={!sheetText.trim()} onPress={() => detect(sheetText)}>
                <Text style={styles.primaryText}>Detectar movimientos</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.ghost} onPress={() => { setSheet(false); onOpenUpgrade(); }}>
              <Text style={styles.ghostText}>✨ Registra con IA desde Essential — Mejorar mi plan</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={{ alignItems: "center", minHeight: 44, justifyContent: "center", marginTop: 6 }} onPress={() => { setSheet(false); setManual(true); }}>
            <Text style={styles.link}>Prefiero registrar a mano</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <AddTransactionModal
        visible={manual || Boolean(editing)}
        businessId={biz.id}
        editingTransaction={editing}
        onClose={() => { setManual(false); setEditing(null); }}
      />
      <AiQuickAddModal
        visible={aiText !== undefined}
        businessId={biz.id}
        initialText={aiText}
        onClose={() => setAiText(undefined)}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 16, paddingBottom: 30 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  date: { fontSize: 12, color: colors.inkSoft, textTransform: "capitalize" },
  biz: { fontSize: 20, fontWeight: "700", color: colors.title },
  eye: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 3, marginBottom: 12 },
  segBtn: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  segActive: { backgroundColor: colors.navy900 },
  segText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  segTextActive: { color: "#fff" },
  balance: { backgroundColor: colors.navy900, borderRadius: 18, padding: 18 },
  balLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  balValue: { color: "#fff", fontSize: 30, fontWeight: "700", marginTop: 4 },
  balPill: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  balVs: { color: "rgba(255,255,255,0.65)", fontSize: 11.5 },
  balRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  balBox: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 10 },
  balSub: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  balNum: { color: "#fff", fontSize: 15, fontWeight: "700", marginVertical: 2 },
  delta: { fontSize: 11.5, fontWeight: "700" },
  aiCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginTop: 12, minHeight: 64 },
  aiMic: { fontSize: 26 },
  aiTitle: { fontSize: 14.5, fontWeight: "700", color: colors.title },
  aiSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  kpis: { gap: 10, paddingVertical: 12 },
  kpi: { width: 150, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 },
  kpiLabel: { fontSize: 11, color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 18, fontWeight: "700", color: colors.title, marginVertical: 3 },
  kpiNote: { fontSize: 11.5, color: colors.inkSoft, fontWeight: "600" },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.title, marginBottom: 8 },
  muted: { fontSize: 12, color: colors.inkSoft },
  strip: { fontSize: 12, color: colors.ink, backgroundColor: colors.cream, borderRadius: 8, padding: 8, marginBottom: 10, fontWeight: "600" },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: BAR_ZONE + 22, marginBottom: 6 },
  barCol: { flex: 1, minWidth: 0, justifyContent: "flex-end", alignItems: "center", borderRadius: 6, height: BAR_ZONE + 22 },
  barSel: { backgroundColor: colors.cream },
  barPair: { flexDirection: "row", alignItems: "flex-end", gap: 1, height: BAR_ZONE },
  bar: { width: 5, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barLabel: { fontSize: 9.5, color: colors.inkSoft, height: 18, marginTop: 4 },
  legend: { fontSize: 11.5, fontWeight: "600", color: colors.green600 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  catName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  catAmt: { fontSize: 13, fontWeight: "700", color: colors.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cream, marginTop: 4 },
  fiado: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  cobrar: { minHeight: 44, minWidth: 60, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  link: { fontSize: 13, fontWeight: "700", color: colors.title },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  tx: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderTopWidth: 1, borderTopColor: colors.line },
  txArrow: { fontSize: 18, fontWeight: "700", width: 22, textAlign: "center" },
  primary: { backgroundColor: colors.green600, borderRadius: 12, minHeight: 48, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  ghost: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, marginTop: 8 },
  ghostText: { color: colors.title, fontWeight: "700", fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: colors.white, padding: 18, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, minHeight: 80, fontSize: 14, color: colors.ink, backgroundColor: colors.input, textAlignVertical: "top", marginBottom: 6 },
}));
