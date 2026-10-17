import { describe, expect, it } from "vitest";
import { computeBalance, currency, digitsOnly, filterCategoriesByType, formatThousands, localDateKey, monthIdOf, monthLabel, previousMonthId } from "./index";

describe("money", () => {
  it("deja solo dígitos y quita ceros a la izquierda", () => {
    expect(digitsOnly("$ 0050.000,5")).toBe("500005");
    expect(digitsOnly("abc")).toBe("");
  });
  it("formatea miles con punto", () => {
    expect(formatThousands("50000")).toBe("50.000");
    expect(formatThousands("")).toBe("");
  });
});

describe("months", () => {
  it("usa hora de Colombia (UTC-5)", () => {
    // 2026-11-01 02:00 UTC = 2026-10-31 21:00 en Colombia
    expect(monthIdOf(Date.UTC(2026, 10, 1, 2, 0))).toBe("2026-10");
    expect(monthIdOf(Date.UTC(2026, 10, 1, 5, 0))).toBe("2026-11");
  });
  it("calcula el mes anterior", () => {
    expect(previousMonthId("2026-01")).toBe("2025-12");
    expect(previousMonthId("2026-10")).toBe("2026-09");
  });
  it("da la etiqueta en español", () => {
    expect(monthLabel("2026-10")).toBe("octubre de 2026");
  });
});

describe("dates", () => {
  it("arma la clave YYYY-MM-DD con la fecha local", () => {
    expect(localDateKey(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
  });
});

describe("totales", () => {
  it("suma ingresos, egresos y balance", () => {
    const r = computeBalance([
      { type: "ingreso", amount: 100000 },
      { type: "egreso", amount: 30000 },
      { type: "ingreso", amount: 5000 },
    ]);
    expect(r).toEqual({ balance: 75000, totalIngresos: 105000, totalEgresos: 30000 });
  });
  it("lista vacía da ceros", () => {
    expect(computeBalance([])).toEqual({ balance: 0, totalIngresos: 0, totalEgresos: 0 });
  });
  it("formatea pesos colombianos", () => {
    expect(currency.format(50000).replace(/\s/g, " ")).toMatch(/50\.000/);
  });
});

describe("categorías", () => {
  it("filtra por tipo", () => {
    const cats = [
      { id: "1", name: "Ventas", type: "ingreso", icon: "" },
      { id: "2", name: "Insumos", type: "egreso", icon: "" },
    ] as never[];
    expect(filterCategoriesByType(cats, "egreso").map((c: { name: string }) => c.name)).toEqual(["Insumos"]);
  });
});
