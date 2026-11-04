import { describe, expect, it } from "vitest";
import {
  computeDashboard, dayKeyOf, deltaTone, formatCompactCOP, formatPctChange, formatPercent, formatPoints,
  methodLabel, pctChange, periodSpec, relativeTime, sourceLabel, summarizeReceivables,
} from "./dashboard";
import type { Receivable, Summary } from "./types";

// 16 oct 2026, 11:00 hora de Colombia (16:00 UTC)
const NOW = Date.UTC(2026, 9, 16, 16, 0, 0);

const sum = (p: Partial<Summary>): Summary => ({
  income: 0, expense: 0, count: 0, aiCount: 0,
  expenseByCategory: {}, incomeByCategory: {}, incomeByMethod: {}, ...p,
});

describe("periodSpec", () => {
  it("7d: siete días terminando hoy, con etiqueta de día de la semana", () => {
    const s = periodSpec("7d", NOW);
    expect(s.granularity).toBe("day");
    expect(s.points).toHaveLength(7);
    expect(s.points[6].key).toBe("day-2026-10-16");
    expect(s.points[0].key).toBe("day-2026-10-10");
    expect(s.points[6].shortLabel).toBe("vie");
    expect(s.points[6].fullLabel).toBe("vie 16 oct");
    expect(s.previousPoints[6].key).toBe("day-2026-10-09");
    expect(s.fromId).toBe("day-2026-10-03");
    expect(s.toId).toBe("day-2026-10-16");
  });
  it("30d: etiqueta corta es el número del día y cruza de mes", () => {
    const s = periodSpec("30d", NOW);
    expect(s.points).toHaveLength(30);
    expect(s.points[0].key).toBe("day-2026-09-17");
    expect(s.points[0].shortLabel).toBe("17");
    expect(s.fromId).toBe("day-2026-08-18");
  });
  it("12m: doce meses y cruza de año", () => {
    const s = periodSpec("12m", NOW);
    expect(s.granularity).toBe("month");
    expect(s.points).toHaveLength(12);
    expect(s.points[11].key).toBe("month-2026-10");
    expect(s.points[0].key).toBe("month-2025-11");
    expect(s.points[11].fullLabel).toBe("octubre de 2026");
    expect(s.previousPoints[11].key).toBe("month-2025-10");
    expect(s.fromId).toBe("month-2024-11");
  });
  it("usa la hora de Colombia: 2 a. m. UTC del 17 todavía es 16", () => {
    expect(dayKeyOf(Date.UTC(2026, 9, 17, 2, 0))).toBe("2026-10-16");
    expect(periodSpec("7d", Date.UTC(2026, 9, 17, 2, 0)).points[6].key).toBe("day-2026-10-16");
  });
});

describe("computeDashboard", () => {
  const data: Record<string, Summary> = {
    "day-2026-10-16": sum({ income: 100000, expense: 40000, count: 3, aiCount: 1, expenseByCategory: { Insumos: 30000, Arriendo: 10000 }, incomeByMethod: { nequi: 60000, efectivo: 40000 } }),
    "day-2026-10-12": sum({ income: 200000, expense: 60000, count: 4, aiCount: 2, expenseByCategory: { Insumos: 60000 }, incomeByMethod: { efectivo: 200000 } }),
    "day-2026-10-05": sum({ income: 150000, expense: 100000, count: 2 }), // período anterior
  };
  const d = computeDashboard("7d", NOW, data);

  it("suma los totales del período", () => {
    expect(d.totals).toMatchObject({ income: 300000, expense: 100000, balance: 200000, count: 7, aiCount: 3 });
    expect(d.totals.marginPct).toBeCloseTo(66.67, 1);
    expect(d.isEmpty).toBe(false);
  });
  it("compara con el período anterior", () => {
    expect(d.previous).toMatchObject({ income: 150000, expense: 100000, balance: 50000 });
    expect(d.comparison.incomePct).toBeCloseTo(100);
    expect(d.comparison.expensePct).toBeCloseTo(0);
    expect(d.comparison.balancePct).toBeCloseTo(300);
    expect(d.comparison.marginPts).toBeCloseTo(66.67 - 33.33, 1);
  });
  it("arma la serie con ceros donde no hay resumen", () => {
    expect(d.series).toHaveLength(7);
    expect(d.series[6]).toMatchObject({ key: "day-2026-10-16", income: 100000, expense: 40000 });
    expect(d.series[0]).toMatchObject({ income: 0, expense: 0 });
  });
  it("ordena gastos por categoría de mayor a menor con su %", () => {
    expect(d.expenseByCategory.map((c) => c.name)).toEqual(["Insumos", "Arriendo"]);
    expect(d.expenseByCategory[0].amount).toBe(90000);
    expect(d.expenseByCategory[0].pct).toBeCloseTo(90);
  });
  it("suma ingresos por medio de pago", () => {
    expect(d.incomeByMethod[0]).toMatchObject({ name: "efectivo", amount: 240000 });
    expect(d.incomeByMethod[1]).toMatchObject({ name: "nequi", amount: 60000 });
  });
  it("sin datos: vacío y margen nulo", () => {
    const e = computeDashboard("30d", NOW, {});
    expect(e.isEmpty).toBe(true);
    expect(e.totals.marginPct).toBeNull();
    expect(e.comparison.incomePct).toBe(0);
    expect(e.comparison.marginPts).toBeNull();
  });
  it("12m usa los resúmenes mensuales", () => {
    const m = computeDashboard("12m", NOW, { "month-2026-10": sum({ income: 500, count: 1 }), "month-2026-03": sum({ income: 300, count: 1 }), "day-2026-10-16": sum({ income: 999, count: 9 }) });
    expect(m.totals.income).toBe(800);
  });
});

describe("pctChange", () => {
  it("sin base devuelve null, salvo 0 → 0", () => {
    expect(pctChange(50, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });
  it("usa el valor absoluto de la base si es negativa", () => {
    expect(pctChange(-50, -100)).toBeCloseTo(50);
    expect(pctChange(50, -100)).toBeCloseTo(150);
  });
});

describe("deltaTone", () => {
  it("para egresos subir es malo", () => {
    expect(deltaTone("expense", 10)).toBe("bad");
    expect(deltaTone("expense", -10)).toBe("good");
  });
  it("para ingresos, balance y margen subir es bueno", () => {
    expect(deltaTone("income", 10)).toBe("good");
    expect(deltaTone("balance", -3)).toBe("bad");
    expect(deltaTone("margin", 2)).toBe("good");
  });
  it("sin cambio o sin base es neutro", () => {
    expect(deltaTone("income", 0)).toBe("neutral");
    expect(deltaTone("income", null)).toBe("neutral");
  });
});

describe("summarizeReceivables", () => {
  const r = (id: string, amount: number, status: Receivable["status"], due?: Date, created = 1): Receivable => ({
    id, clientName: id, amount, status, dueDate: due, createdAt: new Date(created),
  });
  const list = [
    r("pagado", 999, "pagado"),
    r("futuro", 100, "pendiente", new Date(NOW + 5 * 86400000)),
    r("vencido-viejo", 200, "pendiente", new Date(NOW - 10 * 86400000)),
    r("sin-fecha", 300, "pendiente"),
    r("vencido-marcado", 400, "vencido", new Date(NOW - 2 * 86400000)),
    r("futuro-cercano", 500, "pendiente", new Date(NOW + 1 * 86400000)),
  ];
  const s = summarizeReceivables(list, NOW);
  it("excluye pagados del total", () => {
    expect(s.totalPending).toBe(1500);
    expect(s.pendingCount).toBe(5);
  });
  it("cuenta los vencidos por estado o por fecha", () => {
    expect(s.overdueCount).toBe(2);
  });
  it("ordena: vencidos primero (el más viejo antes) y luego por fecha", () => {
    expect(s.top.map((x) => x.id)).toEqual(["vencido-viejo", "vencido-marcado", "futuro-cercano"]);
    expect(s.top[0].overdue).toBe(true);
    expect(s.top[2].overdue).toBe(false);
  });
  it("los que no tienen fecha van al final", () => {
    const all = summarizeReceivables(list, NOW, 10).top.map((x) => x.id);
    expect(all[all.length - 1]).toBe("sin-fecha");
  });
});

describe("formatos", () => {
  it("monto compacto", () => {
    expect(formatCompactCOP(950)).toBe("$ 950");
    expect(formatCompactCOP(360000)).toBe("$ 360 mil");
    expect(formatCompactCOP(1200000)).toBe("$ 1,2 M");
    expect(formatCompactCOP(2000000)).toBe("$ 2 M");
    expect(formatCompactCOP(12400000)).toBe("$ 12 M");
    expect(formatCompactCOP(999600)).toBe("$ 1 M");
    expect(formatCompactCOP(-45000)).toBe("-$ 45 mil");
    expect(formatCompactCOP(0)).toBe("$ 0");
  });
  it("variaciones", () => {
    expect(formatPctChange(12.4)).toBe("+12 %");
    expect(formatPctChange(-8.2)).toBe("-8 %");
    expect(formatPctChange(0.2)).toBe("0 %");
    expect(formatPctChange(null)).toBe("Nuevo");
    expect(formatPoints(3.24)).toBe("+3,2 pts");
    expect(formatPoints(-5)).toBe("-5 pts");
    expect(formatPoints(null)).toBe("—");
    expect(formatPercent(62.5)).toBe("62,5 %");
    expect(formatPercent(40)).toBe("40 %");
  });
  it("hora relativa", () => {
    expect(relativeTime(NOW - 20_000, NOW)).toBe("ahora");
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe("hace 5 min");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("hace 3 h");
    expect(relativeTime(NOW - 24 * 3_600_000, NOW)).toBe("ayer");
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe("hace 3 días");
    expect(relativeTime(NOW - 20 * 86_400_000, NOW)).toBe("26 sep");
  });
  it("etiquetas", () => {
    expect(methodLabel("nequi")).toBe("Nequi");
    expect(methodLabel("otro")).toBe("Otro");
    expect(sourceLabel("ia_voz")).toBe("IA voz");
    expect(sourceLabel("ia_texto")).toBe("IA texto");
    expect(sourceLabel("manual")).toBe("Manual");
  });
});
