import type { PaymentMethod, Receivable, Summary, Transaction } from "./types";

/** Lógica pura del dashboard (sin React ni Firebase): períodos, totales, comparación y desgloses. */

export type DashboardPeriod = "7d" | "30d" | "12m";
export type Granularity = "day" | "month";

/** Colombia es UTC-5 todo el año; los resúmenes del servidor se agrupan con esa hora. */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha "de pared" en Colombia como un Date en UTC (se leen con getUTC*). */
function colombia(ms: number) {
  return new Date(ms - TZ_OFFSET_MS);
}

/** "2026-10-16" (día en Colombia). */
export function dayKeyOf(ms: number): string {
  const d = colombia(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export interface PeriodPoint {
  /** Id del documento de resumen: "day-2026-10-16" o "month-2026-10". */
  key: string;
  shortLabel: string;
  fullLabel: string;
}

export interface PeriodSpec {
  period: DashboardPeriod;
  granularity: Granularity;
  /** Los puntos del período actual, del más antiguo al más reciente. */
  points: PeriodPoint[];
  /** Los puntos del período anterior, de igual duración. */
  previousPoints: PeriodPoint[];
  /** Rango de ids que cubre anterior + actual (para pedirlo en una sola consulta). */
  fromId: string;
  toId: string;
}

function dayPoint(ms: number, short: "weekday" | "number"): PeriodPoint {
  const d = colombia(ms);
  const dd = d.getUTCDate();
  return {
    key: `day-${dayKeyOf(ms)}`,
    shortLabel: short === "weekday" ? WEEKDAYS[d.getUTCDay()] : String(dd),
    fullLabel: `${WEEKDAYS[d.getUTCDay()]} ${dd} ${MONTHS_SHORT[d.getUTCMonth()]}`,
  };
}

function monthPoint(year: number, monthIndex: number): PeriodPoint {
  // Date.UTC normaliza meses fuera de rango (-3 → septiembre del año anterior).
  const d = new Date(Date.UTC(year, monthIndex, 1));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return {
    key: `month-${y}-${pad(m + 1)}`,
    shortLabel: MONTHS_SHORT[m],
    fullLabel: `${MONTHS_LONG[m]} de ${y}`,
  };
}

export function periodSpec(period: DashboardPeriod, nowMs: number): PeriodSpec {
  let points: PeriodPoint[];
  let previousPoints: PeriodPoint[];
  let granularity: Granularity;

  if (period === "12m") {
    granularity = "month";
    const now = colombia(nowMs);
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    points = Array.from({ length: 12 }, (_, i) => monthPoint(y, m - (11 - i)));
    previousPoints = Array.from({ length: 12 }, (_, i) => monthPoint(y, m - (23 - i)));
  } else {
    granularity = "day";
    const n = period === "7d" ? 7 : 30;
    const short = period === "7d" ? "weekday" : "number";
    points = Array.from({ length: n }, (_, i) => dayPoint(nowMs - (n - 1 - i) * DAY_MS, short));
    previousPoints = Array.from({ length: n }, (_, i) => dayPoint(nowMs - (2 * n - 1 - i) * DAY_MS, short));
  }

  return {
    period,
    granularity,
    points,
    previousPoints,
    fromId: previousPoints[0].key,
    toId: points[points.length - 1].key,
  };
}

// ---------------------------------------------------------------------------
// Totales, comparación y desgloses
// ---------------------------------------------------------------------------

export interface PeriodTotals {
  income: number;
  expense: number;
  balance: number;
  /** balance / ingresos × 100; null si no hubo ingresos. */
  marginPct: number | null;
  count: number;
  aiCount: number;
}

export interface Comparison {
  /** Variación % frente al período anterior; null si no hay base para comparar. */
  incomePct: number | null;
  expensePct: number | null;
  balancePct: number | null;
  /** Variación del margen, en puntos porcentuales. */
  marginPts: number | null;
}

export interface SeriesPoint {
  key: string;
  shortLabel: string;
  fullLabel: string;
  income: number;
  expense: number;
}

export interface Share {
  name: string;
  amount: number;
  /** Porcentaje del total (0–100). */
  pct: number;
}

export interface DashboardData {
  period: DashboardPeriod;
  granularity: Granularity;
  totals: PeriodTotals;
  previous: PeriodTotals;
  comparison: Comparison;
  series: SeriesPoint[];
  expenseByCategory: Share[];
  incomeByMethod: Share[];
  /** true si el período actual no tiene ningún movimiento. */
  isEmpty: boolean;
}

function sumTotals(ids: string[], summaries: Record<string, Summary>): PeriodTotals {
  let income = 0;
  let expense = 0;
  let count = 0;
  let aiCount = 0;
  for (const id of ids) {
    const s = summaries[id];
    if (!s) continue;
    income += s.income;
    expense += s.expense;
    count += s.count;
    aiCount += s.aiCount;
  }
  const balance = income - expense;
  return { income, expense, balance, marginPct: income > 0 ? (balance / income) * 100 : null, count, aiCount };
}

/** Variación % entre dos valores. null si el anterior era 0 y el actual no (no hay base). */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function mergeShares(ids: string[], summaries: Record<string, Summary>, pick: (s: Summary) => Record<string, number>): Share[] {
  const totals = new Map<string, number>();
  for (const id of ids) {
    const s = summaries[id];
    if (!s) continue;
    for (const [name, value] of Object.entries(pick(s))) {
      if (value > 0) totals.set(name, (totals.get(name) ?? 0) + value);
    }
  }
  const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  return Array.from(totals, ([name, amount]) => ({ name, amount, pct: sum > 0 ? (amount / sum) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "es"));
}

/** Arma todo lo que pinta el dashboard a partir de los resúmenes ya leídos. */
export function computeDashboard(
  period: DashboardPeriod,
  nowMs: number,
  summaries: Record<string, Summary>
): DashboardData {
  const spec = periodSpec(period, nowMs);
  const ids = spec.points.map((p) => p.key);
  const prevIds = spec.previousPoints.map((p) => p.key);

  const totals = sumTotals(ids, summaries);
  const previous = sumTotals(prevIds, summaries);

  const comparison: Comparison = {
    incomePct: pctChange(totals.income, previous.income),
    expensePct: pctChange(totals.expense, previous.expense),
    balancePct: pctChange(totals.balance, previous.balance),
    marginPts:
      totals.marginPct !== null && previous.marginPct !== null ? totals.marginPct - previous.marginPct : null,
  };

  const series: SeriesPoint[] = spec.points.map((p) => ({
    key: p.key,
    shortLabel: p.shortLabel,
    fullLabel: p.fullLabel,
    income: summaries[p.key]?.income ?? 0,
    expense: summaries[p.key]?.expense ?? 0,
  }));

  return {
    period,
    granularity: spec.granularity,
    totals,
    previous,
    comparison,
    series,
    expenseByCategory: mergeShares(ids, summaries, (s) => s.expenseByCategory),
    incomeByMethod: mergeShares(ids, summaries, (s) => s.incomeByMethod),
    isEmpty: totals.count === 0,
  };
}

// ---------------------------------------------------------------------------
// Tono de las variaciones
// ---------------------------------------------------------------------------

export type DeltaMetric = "income" | "expense" | "balance" | "margin";
export type Tone = "good" | "bad" | "neutral";

/** Subir ingresos, balance o margen es bueno; subir egresos es malo. */
export function deltaTone(metric: DeltaMetric, value: number | null): Tone {
  if (value === null || Math.abs(value) < 0.05) return "neutral";
  const up = value > 0;
  if (metric === "expense") return up ? "bad" : "good";
  return up ? "good" : "bad";
}

// ---------------------------------------------------------------------------
// Fiados
// ---------------------------------------------------------------------------

export interface UrgentReceivable extends Receivable {
  overdue: boolean;
}

export interface ReceivablesSummary {
  totalPending: number;
  pendingCount: number;
  overdueCount: number;
  /** Los más urgentes: vencidos primero y luego por fecha de vencimiento. */
  top: UrgentReceivable[];
}

export function summarizeReceivables(list: Receivable[], nowMs: number, topN = 3): ReceivablesSummary {
  const pending = list
    .filter((r) => r.status !== "pagado")
    .map((r) => ({
      ...r,
      overdue: r.status === "vencido" || (r.dueDate !== undefined && r.dueDate.getTime() < nowMs),
    }));

  const dueMs = (r: UrgentReceivable) => (r.dueDate ? r.dueDate.getTime() : Number.POSITIVE_INFINITY);
  const top = [...pending]
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const d = dueMs(a) - dueMs(b);
      if (d !== 0 && Number.isFinite(d)) return d;
      if (dueMs(a) !== dueMs(b)) return dueMs(a) === Number.POSITIVE_INFINITY ? 1 : -1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .slice(0, topN);

  return {
    totalPending: pending.reduce((sum, r) => sum + r.amount, 0),
    pendingCount: pending.length,
    overdueCount: pending.filter((r) => r.overdue).length,
    top,
  };
}

// ---------------------------------------------------------------------------
// Formatos
// ---------------------------------------------------------------------------

const trimZero = (s: string) => s.replace(/,0$/, "");

/** Monto compacto para ejes y etiquetas: 950 → "$ 950", 360000 → "$ 360 mil", 1200000 → "$ 1,2 M". */
export function formatCompactCOP(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000 - 500) {
    const m = abs / 1_000_000;
    const text = m >= 10 ? String(Math.round(m)) : trimZero(m.toFixed(1).replace(".", ","));
    return `${sign}$ ${text} M`;
  }
  if (abs >= 1000) return `${sign}$ ${Math.round(abs / 1000)} mil`;
  return `${sign}$ ${Math.round(abs)}`;
}

/** 12.3 → "+12 %", -8 → "-8 %", null → "Nuevo". */
export function formatPctChange(pct: number | null): string {
  if (pct === null) return "Nuevo";
  const r = Math.round(pct);
  if (r === 0) return "0 %";
  return `${r > 0 ? "+" : "-"}${Math.abs(r)} %`;
}

/** Variación del margen en puntos: 3.24 → "+3,2 pts". */
export function formatPoints(pts: number | null): string {
  if (pts === null) return "—";
  const r = Math.round(pts * 10) / 10;
  if (r === 0) return "0 pts";
  return `${r > 0 ? "+" : "-"}${trimZero(Math.abs(r).toFixed(1).replace(".", ","))} pts`;
}

/** 62.5 → "62,5 %" (sin decimales si es entero). */
export function formatPercent(pct: number | null): string {
  if (pct === null) return "—";
  return `${trimZero((Math.round(pct * 10) / 10).toFixed(1).replace(".", ","))} %`;
}

/** Hora relativa: "ahora", "hace 5 min", "hace 3 h", "ayer", "hace 4 días" o "13 oct". */
export function relativeTime(dateMs: number, nowMs: number): string {
  const diff = nowMs - dateMs;
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  const today = dayKeyOf(nowMs);
  const that = dayKeyOf(dateMs);
  if (that === today) return `hace ${Math.floor(diff / 3_600_000)} h`;
  if (that === dayKeyOf(nowMs - DAY_MS)) return "ayer";
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${that}T00:00:00Z`)) / DAY_MS);
  if (days < 7) return `hace ${days} días`;
  const d = colombia(dateMs);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export function methodLabel(method: string): string {
  return (METHOD_LABELS as Record<string, string>)[method] ?? method.charAt(0).toUpperCase() + method.slice(1);
}

export function sourceLabel(source: Transaction["source"]): string {
  return source === "ia_voz" ? "IA voz" : source === "ia_texto" ? "IA texto" : "Manual";
}
