import { describe, expect, it } from "vitest";
import {
  createBusinessDecision,
  expiryDecision,
  inviteDecision,
  paymentDecision,
  planTrim,
  trialDecision,
  PAID_PLAN_DAYS,
  type PaymentState,
} from "./plans";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 14, 12);
const free: PaymentState = { plan: "emprendedor", trial: false, expiresMs: null, pending: null };

describe("paymentDecision", () => {
  it("usuario gratis que paga: 30 días desde ahora", () => {
    const r = paymentDecision({ nowMs: NOW, state: free, paid: "pro" });
    expect(r).toMatchObject({ plan: "pro", expiresMs: NOW + PAID_PLAN_DAYS * DAY, appliedNow: true });
  });

  it("renovar el mismo plan suma desde el vencimiento actual", () => {
    const state: PaymentState = { plan: "pro", trial: false, expiresMs: NOW + 10 * DAY, pending: null };
    const r = paymentDecision({ nowMs: NOW, state, paid: "pro" });
    expect(r.expiresMs).toBe(NOW + 40 * DAY);
  });

  it("subir de plan empieza desde ahora", () => {
    const state: PaymentState = { plan: "pro", trial: false, expiresMs: NOW + 10 * DAY, pending: null };
    const r = paymentDecision({ nowMs: NOW, state, paid: "premium" });
    expect(r).toMatchObject({ plan: "premium", expiresMs: NOW + 30 * DAY, appliedNow: true });
  });

  it("pagar un plan inferior no baja el plan: queda como crédito", () => {
    const state: PaymentState = { plan: "premium", trial: false, expiresMs: NOW + 10 * DAY, pending: null };
    const r = paymentDecision({ nowMs: NOW, state, paid: "pro" });
    expect(r.plan).toBe("premium");
    expect(r.expiresMs).toBe(NOW + 10 * DAY);
    expect(r.appliedNow).toBe(false);
    expect(r.pending).toEqual({ plan: "pro", startMs: NOW + 10 * DAY, days: 30 });
  });

  it("dos pagos del mismo plan inferior acumulan días de crédito", () => {
    const state: PaymentState = {
      plan: "premium",
      trial: false,
      expiresMs: NOW + 10 * DAY,
      pending: { plan: "pro", startMs: NOW + 10 * DAY, days: 30 },
    };
    expect(paymentDecision({ nowMs: NOW, state, paid: "pro" }).pending?.days).toBe(60);
  });

  it("una prueba gratis se reemplaza por el plan pagado desde ahora", () => {
    const state: PaymentState = { plan: "premium", trial: true, expiresMs: NOW + 5 * DAY, pending: null };
    const r = paymentDecision({ nowMs: NOW, state, paid: "pro" });
    expect(r).toMatchObject({ plan: "pro", expiresMs: NOW + 30 * DAY, appliedNow: true });
  });

  it("plan vencido se trata como sin plan", () => {
    const state: PaymentState = { plan: "pro", trial: false, expiresMs: NOW - DAY, pending: null };
    expect(paymentDecision({ nowMs: NOW, state, paid: "pro" }).expiresMs).toBe(NOW + 30 * DAY);
  });
});

describe("expiryDecision", () => {
  it("sin crédito vuelve a emprendedor", () => {
    expect(expiryDecision({ nowMs: NOW, pending: null })).toEqual({ plan: "emprendedor", expiresMs: null, pending: null });
  });
  it("con crédito activa el plan pendiente", () => {
    const r = expiryDecision({ nowMs: NOW, pending: { plan: "pro", startMs: NOW - DAY, days: 30 } });
    expect(r).toMatchObject({ plan: "pro", expiresMs: NOW + 30 * DAY });
  });
});

describe("límites de plan", () => {
  it("emprendedor no puede crear un segundo negocio", () => {
    expect(createBusinessDecision({ plan: "emprendedor", ownedCount: 1, name: "Otro" })?.code).toBe("resource-exhausted");
  });
  it("premium puede crear varios", () => {
    expect(createBusinessDecision({ plan: "premium", ownedCount: 5, name: "Otro" })).toBeNull();
  });
  it("invitar respeta el cupo contando pendientes", () => {
    const r = inviteDecision({
      plan: "pro", email: "a@b.co", ownerEmail: "o@b.co", memberEmails: [], memberCount: 1, pendingEmails: ["x@b.co"],
    });
    expect(r?.code).toBe("resource-exhausted");
  });
  it("planTrim bloquea negocios sobrantes al bajar a emprendedor", () => {
    const r = planTrim(
      [
        { id: "a", createdAtMs: 1, members: [] },
        { id: "b", createdAtMs: 2, members: [] },
      ],
      "emprendedor"
    );
    expect(r.unlock).toEqual(["a"]);
    expect(r.lock).toEqual(["b"]);
  });
  it("la prueba solo se usa una vez por plan", () => {
    expect(
      trialDecision({ target: "pro", currentPlan: "emprendedor", currentIsTrial: false, trialsUsed: { pro: true } })?.code
    ).toBe("already-exists");
  });
});
