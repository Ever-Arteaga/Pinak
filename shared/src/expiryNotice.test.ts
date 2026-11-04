import { describe, expect, it } from "vitest";
import { expiryNotice } from "./expiryNotice";

const NOW = Date.UTC(2026, 9, 25, 12);
const DAY = 86400000;
const pro = (d: number, trial = false) => ({ plan: "pro", planTrial: trial, expiresMs: NOW + d * DAY });

describe("expiryNotice", () => {
  it("escalones 7, 3 y 1", () => {
    expect(expiryNotice(pro(8), NOW)).toBeNull();
    expect(expiryNotice(pro(7), NOW)?.level).toBe(7);
    expect(expiryNotice(pro(4), NOW)?.level).toBe(7);
    expect(expiryNotice(pro(3), NOW)?.level).toBe(3);
    expect(expiryNotice(pro(2), NOW)?.level).toBe(3);
    expect(expiryNotice(pro(1), NOW)?.level).toBe(1);
    expect(expiryNotice(pro(0.2), NOW)?.level).toBe(1);
  });
  it("no avisa en gratis ni vencidos", () => {
    expect(expiryNotice({ plan: "emprendedor", planTrial: false, expiresMs: NOW + DAY }, NOW)).toBeNull();
    expect(expiryNotice(pro(-1), NOW)).toBeNull();
    expect(expiryNotice({ plan: "pro", planTrial: false, expiresMs: null }, NOW)).toBeNull();
  });
  it("distingue prueba de plan pagado y cambia la clave por escalón", () => {
    expect(expiryNotice(pro(2, true), NOW)?.title).toContain("prueba");
    expect(expiryNotice(pro(2), NOW)?.title).toContain("vence");
    expect(expiryNotice(pro(2), NOW)?.key).not.toBe(expiryNotice(pro(1), NOW)?.key);
  });
});

describe("plan Essential", () => {
  it("avisa el vencimiento con el nombre del plan", () => {
    const n = expiryNotice({ plan: "essential", planTrial: false, expiresMs: NOW + 3 * DAY }, NOW);
    expect(n?.title).toContain("Essential");
  });
});

