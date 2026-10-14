import { describe, expect, it } from "vitest";
import {
  computeStats,
  dayIdOf,
  isValidMonthId,
  monthIdOf,
  monthRange,
  previousMonthId,
  sanitizeDiagnosisText,
  type TxInput,
} from "./diagnosisStats";

// Hora de Colombia = UTC-5
const co = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h + 5);

describe("meses en hora de Colombia", () => {
  it("las 23:30 del 31 de octubre (Colombia) siguen siendo octubre", () => {
    // 04:30 UTC del 1 de noviembre = 23:30 del 31 de octubre en Colombia
    expect(monthIdOf(Date.UTC(2026, 10, 1, 4, 30))).toBe("2026-10");
    expect(monthIdOf(Date.UTC(2026, 10, 1, 5, 0))).toBe("2026-11");
  });
  it("dayIdOf usa la fecha colombiana", () => {
    expect(dayIdOf(Date.UTC(2026, 9, 14, 3, 0))).toBe("2026-10-13");
  });
  it("mes anterior cruza el año", () => {
    expect(previousMonthId("2026-01")).toBe("2025-12");
    expect(previousMonthId("2026-10")).toBe("2026-09");
  });
  it("valida ids de mes", () => {
    expect(isValidMonthId("2026-10")).toBe(true);
    expect(isValidMonthId("2026-13")).toBe(false);
    expect(isValidMonthId("2026-1")).toBe(false);
  });
  it("monthRange cubre el mes completo", () => {
    const { startMs, endMs } = monthRange("2026-10");
    expect(endMs - startMs).toBe(31 * 24 * 60 * 60 * 1000);
    expect(monthIdOf(startMs)).toBe("2026-10");
    expect(monthIdOf(endMs - 1)).toBe("2026-10");
  });
});

describe("computeStats", () => {
  const tx = (type: TxInput["type"], amount: number, category: string, method = "efectivo", dateMs = co(2026, 10, 5)): TxInput => ({
    type, amount, category, method, dateMs,
  });

  it("calcula totales, balance y margen", () => {
    const s = computeStats({
      month: "2026-10",
      transactions: [tx("ingreso", 1000, "Ventas"), tx("egreso", 400, "Insumos")],
      previousTransactions: [],
      receivables: [],
      nowMs: co(2026, 10, 20),
    });
    expect(s).toMatchObject({ income: 1000, expenses: 400, balance: 600, marginPct: 60, txCount: 2 });
    expect(s.previous).toBeNull();
  });

  it("sin ingresos el margen es null", () => {
    const s = computeStats({
      month: "2026-10",
      transactions: [tx("egreso", 400, "Insumos")],
      previousTransactions: [],
      receivables: [],
      nowMs: co(2026, 10, 20),
    });
    expect(s.marginPct).toBeNull();
  });

  it("compara con el mes anterior", () => {
    const s = computeStats({
      month: "2026-10",
      transactions: [tx("ingreso", 1200, "Ventas")],
      previousTransactions: [tx("ingreso", 1000, "Ventas", "efectivo", co(2026, 9, 5))],
      receivables: [],
      nowMs: co(2026, 10, 20),
    });
    expect(s.change?.incomePct).toBe(20);
  });

  it("ordena las categorías de gasto de mayor a menor", () => {
    const s = computeStats({
      month: "2026-10",
      transactions: [tx("egreso", 100, "A"), tx("egreso", 300, "B")],
      previousTransactions: [],
      receivables: [],
      nowMs: co(2026, 10, 20),
    });
    expect(s.topExpenseCategories.map((c) => c.category)).toEqual(["B", "A"]);
    expect(s.topExpenseCategories[0].pct).toBe(75);
  });

  it("cuenta fiados vencidos", () => {
    const s = computeStats({
      month: "2026-10",
      transactions: [tx("ingreso", 100, "Ventas")],
      previousTransactions: [],
      receivables: [
        { amount: 50, status: "pendiente", dueDateMs: co(2026, 10, 1) },
        { amount: 70, status: "pendiente", dueDateMs: co(2026, 11, 1) },
      ],
      nowMs: co(2026, 10, 20),
    });
    expect(s.receivables).toMatchObject({ pendingCount: 2, pendingTotal: 120, overdueCount: 1, overdueTotal: 50 });
  });
});

describe("sanitizeDiagnosisText", () => {
  it("rechaza respuestas sin resumen", () => {
    expect(sanitizeDiagnosisText({ resumen: "  " })).toBeNull();
    expect(sanitizeDiagnosisText(null)).toBeNull();
  });
  it("limita listas y recorta textos", () => {
    const r = sanitizeDiagnosisText({
      resumen: "ok",
      hallazgos: Array.from({ length: 9 }, (_, i) => `h${i}`),
      recomendaciones: ["a", "", "b"],
      alerta: "",
    });
    expect(r?.hallazgos).toHaveLength(5);
    expect(r?.recomendaciones).toEqual(["a", "b"]);
    expect(r?.alerta).toBeNull();
  });
});
