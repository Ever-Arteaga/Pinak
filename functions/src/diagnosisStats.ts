/**
 * Estadísticas del diagnóstico financiero, calculadas por código (no por la IA).
 * La IA solo recibe estas cifras ya calculadas y redacta la interpretación:
 * los modelos de lenguaje se equivocan haciendo cuentas, así que nunca las hacen.
 *
 * Funciones puras, sin dependencias de Firebase.
 */

// Colombia está en UTC-5 todo el año (no tiene horario de verano).
const TZ_OFFSET_HOURS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TxInput {
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  method: string;
  dateMs: number;
}

export interface ReceivableInput {
  amount: number;
  status: string;
  dueDateMs: number | null;
}

export interface CategoryShare {
  category: string;
  amount: number;
  pct: number; // % del total de su tipo (ingresos o egresos)
}

export interface DiagnosisStats {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  marginPct: number | null; // balance / ingresos; null si no hubo ingresos
  txCount: number;
  topExpenseCategories: CategoryShare[];
  topIncomeCategories: CategoryShare[];
  incomeByMethod: { method: string; amount: number; pct: number }[];
  bestDay: { date: string; income: number } | null;
  previous: { income: number; expenses: number; balance: number } | null;
  change: { incomePct: number | null; expensesPct: number | null } | null;
  receivables: {
    pendingCount: number;
    pendingTotal: number;
    overdueCount: number;
    overdueTotal: number;
    oldestOverdueDays: number | null;
  };
}

// ---------------------------------------------------------------------------
// Meses (siempre en hora de Colombia)
// ---------------------------------------------------------------------------
export function isValidMonthId(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-10" correspondiente a un instante, en hora de Colombia. */
export function monthIdOf(ms: number): string {
  const shifted = new Date(ms - TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthId(monthId: string): string {
  const [y, m] = monthId.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Inicio (incluido) y fin (excluido) del mes, en milisegundos UTC. */
export function monthRange(monthId: string): { startMs: number; endMs: number } {
  const [y, m] = monthId.split("-").map(Number);
  return {
    startMs: Date.UTC(y, m - 1, 1, TZ_OFFSET_HOURS),
    endMs: Date.UTC(y, m, 1, TZ_OFFSET_HOURS),
  };
}

function dayKey(ms: number): string {
  const s = new Date(ms - TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(
    s.getUTCDate()
  ).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------
const round1 = (n: number) => Math.round(n * 10) / 10;

function shares(map: Map<string, number>, total: number, top: number): CategoryShare[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount),
      pct: total > 0 ? round1((amount / total) * 100) : 0,
    }));
}

function sumByType(txs: TxInput[]) {
  let income = 0;
  let expenses = 0;
  for (const t of txs) {
    if (t.type === "ingreso") income += t.amount;
    else expenses += t.amount;
  }
  return { income, expenses };
}

function pctChange(now: number, before: number): number | null {
  return before > 0 ? round1(((now - before) / before) * 100) : null;
}

export function computeStats(input: {
  month: string;
  transactions: TxInput[];
  previousTransactions: TxInput[];
  receivables: ReceivableInput[];
  nowMs: number;
}): DiagnosisStats {
  const { month, transactions, previousTransactions, receivables, nowMs } = input;

  const { income, expenses } = sumByType(transactions);

  const expenseByCat = new Map<string, number>();
  const incomeByCat = new Map<string, number>();
  const incomeByMethod = new Map<string, number>();
  const incomeByDay = new Map<string, number>();

  for (const t of transactions) {
    if (t.type === "egreso") {
      expenseByCat.set(t.category, (expenseByCat.get(t.category) ?? 0) + t.amount);
    } else {
      incomeByCat.set(t.category, (incomeByCat.get(t.category) ?? 0) + t.amount);
      incomeByMethod.set(t.method, (incomeByMethod.get(t.method) ?? 0) + t.amount);
      const k = dayKey(t.dateMs);
      incomeByDay.set(k, (incomeByDay.get(k) ?? 0) + t.amount);
    }
  }

  let bestDay: DiagnosisStats["bestDay"] = null;
  for (const [date, amount] of incomeByDay) {
    if (!bestDay || amount > bestDay.income) bestDay = { date, income: Math.round(amount) };
  }

  // Mes anterior: solo se compara si tuvo movimientos.
  let previous: DiagnosisStats["previous"] = null;
  let change: DiagnosisStats["change"] = null;
  if (previousTransactions.length > 0) {
    const p = sumByType(previousTransactions);
    previous = {
      income: Math.round(p.income),
      expenses: Math.round(p.expenses),
      balance: Math.round(p.income - p.expenses),
    };
    change = {
      incomePct: pctChange(income, p.income),
      expensesPct: pctChange(expenses, p.expenses),
    };
  }

  // Fiados: vencido = marcado "vencido" o pendiente con fecha límite ya pasada.
  let pendingCount = 0;
  let pendingTotal = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  let oldestOverdueMs: number | null = null;
  for (const r of receivables) {
    if (r.status !== "pendiente" && r.status !== "vencido") continue;
    pendingCount += 1;
    pendingTotal += r.amount;
    const isOverdue =
      r.status === "vencido" || (r.dueDateMs !== null && r.dueDateMs < nowMs);
    if (isOverdue) {
      overdueCount += 1;
      overdueTotal += r.amount;
      if (r.dueDateMs !== null && (oldestOverdueMs === null || r.dueDateMs < oldestOverdueMs)) {
        oldestOverdueMs = r.dueDateMs;
      }
    }
  }

  return {
    month,
    income: Math.round(income),
    expenses: Math.round(expenses),
    balance: Math.round(income - expenses),
    marginPct: income > 0 ? round1(((income - expenses) / income) * 100) : null,
    txCount: transactions.length,
    topExpenseCategories: shares(expenseByCat, expenses, 5),
    topIncomeCategories: shares(incomeByCat, income, 3),
    incomeByMethod: shares(incomeByMethod, income, 5).map((s) => ({
      method: s.category,
      amount: s.amount,
      pct: s.pct,
    })),
    bestDay,
    previous,
    change,
    receivables: {
      pendingCount,
      pendingTotal: Math.round(pendingTotal),
      overdueCount,
      overdueTotal: Math.round(overdueTotal),
      oldestOverdueDays:
        oldestOverdueMs === null ? null : Math.max(0, Math.floor((nowMs - oldestOverdueMs) / DAY_MS)),
    },
  };
}

// ---------------------------------------------------------------------------
// Respuesta de la IA: se valida y se recorta, nunca se confía a ciegas.
// ---------------------------------------------------------------------------
export interface DiagnosisText {
  resumen: string;
  hallazgos: string[];
  recomendaciones: string[];
  alerta: string | null;
}

const cut = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function cleanList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => cut(x, maxLen))
    .filter((x) => x.length > 0)
    .slice(0, maxItems);
}

/** Devuelve null si la respuesta no trae un resumen utilizable. */
export function sanitizeDiagnosisText(raw: unknown): DiagnosisText | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const resumen = cut(r.resumen, 700);
  if (!resumen) return null;
  const alerta = cut(r.alerta, 300);
  return {
    resumen,
    hallazgos: cleanList(r.hallazgos, 5, 300),
    recomendaciones: cleanList(r.recomendaciones, 4, 300),
    alerta: alerta ? alerta : null,
  };
}
