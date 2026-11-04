import { describe, it, expect } from "vitest";
import { classifyUser, summarize, parseAdminEmails, isAdminEmail } from "./adminStats";

const NOW = Date.UTC(2026, 9, 25);
const DAY = 86400000;
const base = { uid: "u", email: "a@b.co", businessName: "N", planTrial: false, createdMs: null };

describe("adminStats", () => {
  it("clasifica y cuenta", () => {
    const rows = [
      classifyUser({ ...base, plan: "emprendedor", expiresMs: null }, NOW),
      classifyUser({ ...base, plan: "pro", expiresMs: NOW + 20 * DAY }, NOW),
      classifyUser({ ...base, plan: "pro", planTrial: true, expiresMs: NOW + 3 * DAY }, NOW),
      classifyUser({ ...base, plan: "premium", expiresMs: NOW + 5 * DAY }, NOW),
      classifyUser({ ...base, plan: "premium", expiresMs: NOW - DAY }, NOW),
    ];
    expect(summarize(rows)).toEqual({
      total: 5, gratis: 1, proPago: 1, proPrueba: 1, essentialPago: 0, premiumPago: 1, premiumPrueba: 0, vencidos: 1, porVencer7: 2,
    });
  });
  it("valida administradores sin importar mayúsculas", () => {
    const admins = parseAdminEmails(" Yo@Mail.com , otro@mail.com ");
    expect(isAdminEmail("yo@mail.com", admins)).toBe(true);
    expect(isAdminEmail("x@mail.com", admins)).toBe(false);
    expect(isAdminEmail(undefined, admins)).toBe(false);
    expect(isAdminEmail("a@b.co", parseAdminEmails(undefined))).toBe(false);
  });
});
