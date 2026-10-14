import { describe, expect, it } from "vitest";
import { buildSummaries, safeKey, summaryIds, txDelta, type SummaryTx } from "./summaryCalc";

// 14 de octubre de 2026, 12:00 hora de Colombia
const T = Date.UTC(2026, 9, 14, 17);
const tx = (o: Partial<SummaryTx> = {}): SummaryTx => ({
  type: "ingreso", amount: 1000, category: "Ventas", method: "nequi", source: "manual", dateMs: T, ...o,
});

describe("summaryIds", () => {
  it("usa el día y el mes de Colombia", () => {
    expect(summaryIds(T)).toEqual(["day-2026-10-14", "month-2026-10", "all"]);
    // 04:30 UTC del 1 de noviembre = 23:30 del 31 de octubre en Colombia
    expect(summaryIds(Date.UTC(2026, 10, 1, 4, 30))).toEqual(["day-2026-10-31", "month-2026-10", "all"]);
  });
});

describe("txDelta", () => {
  it("crear suma a día, mes y total", () => {
    const d = txDelta(null, tx());
    expect(Object.keys(d).sort()).toEqual(["all", "day-2026-10-14", "month-2026-10"]);
    expect(d.all).toMatchObject({ income: 1000, expense: 0, count: 1, aiCount: 0 });
    expect(d.all.incomeByCategory).toEqual({ Ventas: 1000 });
    expect(d.all.incomeByMethod).toEqual({ nequi: 1000 });
  });
  it("borrar resta", () => {
    const d = txDelta(tx({ type: "egreso", amount: 300, category: "Insumos" }), null);
    expect(d.all).toMatchObject({ expense: -300, count: -1 });
    expect(d.all.expenseByCategory).toEqual({ Insumos: -300 });
  });
  it("editar el monto solo aplica la diferencia", () => {
    const d = txDelta(tx({ amount: 1000 }), tx({ amount: 1500 }));
    expect(d.all).toMatchObject({ income: 500, count: 0 });
    expect(d.all.incomeByCategory).toEqual({ Ventas: 500 });
  });
  it("editar solo la descripción no genera cambios", () => {
    expect(txDelta(tx(), tx())).toEqual({});
  });
  it("cambiar de día mueve el valor entre resúmenes diarios", () => {
    const d = txDelta(tx(), tx({ dateMs: T + 24 * 60 * 60 * 1000 }));
    expect(d["day-2026-10-14"].income).toBe(-1000);
    expect(d["day-2026-10-15"].income).toBe(1000);
    expect(d.all).toBeUndefined();
  });
  it("cambiar de ingreso a egreso corrige ambos lados", () => {
    const d = txDelta(tx(), tx({ type: "egreso", category: "Insumos" }));
    expect(d.all).toMatchObject({ income: -1000, expense: 1000, count: 0 });
  });
  it("cuenta los registros con IA", () => {
    expect(txDelta(null, tx({ source: "ia_voz" })).all.aiCount).toBe(1);
    expect(txDelta(tx({ source: "ia_texto" }), tx({ source: "manual" })).all.aiCount).toBe(-1);
  });
});

describe("buildSummaries", () => {
  it("coincide con sumar los deltas uno a uno", () => {
    const list = [tx(), tx({ type: "egreso", amount: 400, category: "Insumos" }), tx({ amount: 250, method: "efectivo" })];
    const built = buildSummaries(list);
    expect(built.all).toMatchObject({ income: 1250, expense: 400, count: 3 });
    expect(built.all.incomeByMethod).toEqual({ nequi: 1000, efectivo: 250 });
  });
});

describe("safeKey", () => {
  it("limpia caracteres no permitidos y vacíos", () => {
    expect(safeKey("a.b/c")).toBe("a_b_c");
    expect(safeKey("  ")).toBe("Otros");
    expect(safeKey(undefined)).toBe("Otros");
  });
});
