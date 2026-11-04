import { describe, expect, it } from "vitest";
import { billingProblems, docTotals, endOfDayMs, formatDocNumber, parseBilling } from "./billing";

const ok = {
  mode: "factura" as const, taxStatus: "responsable_iva" as const, taxNote: "",
  resolutionNumber: "18760000001", resolutionDate: "2026-01-15", prefix: "FV",
  rangeFrom: 1, rangeTo: 100, validUntil: "2027-01-15",
};
const NOW = new Date(2026, 9, 30, 12).getTime();

describe("billing", () => {
  it("una configuración completa no tiene problemas", () => {
    expect(billingProblems(ok, 5, NOW)).toEqual([]);
  });
  it("detecta vencida, agotada y datos faltantes", () => {
    expect(billingProblems({ ...ok, validUntil: "2026-10-29" }, 5, NOW)[0]).toContain("vencida");
    expect(billingProblems(ok, 101, NOW)[0]).toContain("agotó");
    expect(billingProblems({ ...ok, resolutionNumber: "" }, 1, NOW).length).toBe(1);
    expect(billingProblems({ ...ok, rangeTo: 0 }, 1, NOW).length).toBe(1);
    expect(billingProblems(undefined, null, NOW).length).toBe(1);
  });
  it("vigente hasta el final del día indicado", () => {
    expect(billingProblems({ ...ok, validUntil: "2026-10-30" }, 5, NOW)).toEqual([]);
    expect(endOfDayMs("2026-13-40")).toBeNull();
  });
  it("calcula IVA por tarifa sobre precios sin IVA", () => {
    const t = docTotals([
      { qty: 2, price: 10000, ivaRate: 19 },
      { qty: 1, price: 5000, ivaRate: 5 },
      { qty: 3, price: 1000 },
    ]);
    expect(t.subtotal).toBe(28000);
    expect(t.ivaByRate).toEqual({ 19: 3800, 5: 250 });
    expect(t.ivaTotal).toBe(4050);
    expect(t.total).toBe(32050);
  });
  it("da formato al número con prefijo", () => {
    expect(formatDocNumber(12, "FV")).toBe("FV-000012");
    expect(formatDocNumber(12)).toBe("000012");
  });
  it("parseBilling tolera datos incompletos", () => {
    expect(parseBilling(undefined)).toBeUndefined();
    expect(parseBilling({ mode: "factura", rangeFrom: "x" })?.rangeFrom).toBe(0);
    expect(parseBilling({})?.mode).toBe("recibo");
  });
});
