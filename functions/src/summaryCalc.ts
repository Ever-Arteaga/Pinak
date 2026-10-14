/**
 * Resúmenes agregados por día, mes y total (puro, sin Firebase).
 * Un cambio en una transacción se convierte en "deltas" que se suman con
 * FieldValue.increment, así el dashboard lee pocos documentos sin importar
 * cuántos movimientos tenga el negocio.
 */
import { dayIdOf, monthIdOf, type SummaryDoc } from "./diagnosisStats";

export interface SummaryTx {
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  method: string;
  source?: string;
  dateMs: number;
}

export function emptySummary(): SummaryDoc {
  return { income: 0, expense: 0, count: 0, aiCount: 0, expenseByCategory: {}, incomeByCategory: {}, incomeByMethod: {} };
}

/** Los nombres de campo de un mapa de Firestore no admiten ciertos caracteres. */
export function safeKey(raw: unknown): string {
  const k = String(raw ?? "").trim().slice(0, 60).replace(/[.[\]*`/~]/g, "_");
  return k || "Otros";
}

/** Ids de los resúmenes a los que pertenece una transacción. */
export function summaryIds(dateMs: number): string[] {
  return [`day-${dayIdOf(dateMs)}`, `month-${monthIdOf(dateMs)}`, "all"];
}

function add(map: Record<string, number>, key: string, n: number) {
  map[key] = (map[key] ?? 0) + n;
}

function apply(into: Record<string, SummaryDoc>, tx: SummaryTx, sign: 1 | -1) {
  const amount = Number(tx.amount) || 0;
  const isIncome = tx.type === "ingreso";
  for (const id of summaryIds(tx.dateMs)) {
    const s = (into[id] ??= emptySummary());
    s.count += sign;
    if (tx.source === "ia_voz" || tx.source === "ia_texto") s.aiCount += sign;
    if (isIncome) {
      s.income += sign * amount;
      add(s.incomeByCategory, safeKey(tx.category), sign * amount);
      add(s.incomeByMethod, safeKey(tx.method), sign * amount);
    } else {
      s.expense += sign * amount;
      add(s.expenseByCategory, safeKey(tx.category), sign * amount);
    }
  }
}

/** Cambios que produce pasar una transacción de `before` a `after` (null = no existía / se borró). */
export function txDelta(before: SummaryTx | null, after: SummaryTx | null): Record<string, SummaryDoc> {
  const out: Record<string, SummaryDoc> = {};
  if (before) apply(out, before, -1);
  if (after) apply(out, after, 1);
  // Se descartan los documentos cuyo efecto neto es cero (p. ej. editar solo la descripción).
  for (const [id, s] of Object.entries(out)) {
    const zero =
      s.count === 0 &&
      s.aiCount === 0 &&
      s.income === 0 &&
      s.expense === 0 &&
      [s.expenseByCategory, s.incomeByCategory, s.incomeByMethod].every((m) => Object.values(m).every((v) => v === 0));
    if (zero) delete out[id];
  }
  return out;
}

/** Resúmenes absolutos a partir de una lista de transacciones (para el script de recálculo). */
export function buildSummaries(txs: SummaryTx[]): Record<string, SummaryDoc> {
  const out: Record<string, SummaryDoc> = {};
  for (const t of txs) apply(out, t, 1);
  return out;
}
