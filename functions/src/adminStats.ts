/** Lógica pura del panel de administración (sin Firebase, para poder probarla). */

export type AdminPlanState = "gratis" | "pago" | "prueba" | "vencido";

export interface AdminUserInput {
  uid: string;
  email: string;
  businessName: string;
  plan: string;
  planTrial: boolean;
  expiresMs: number | null;
  createdMs: number | null;
}

export interface AdminUserRow {
  uid: string;
  email: string;
  businessName: string;
  plan: "emprendedor" | "essential" | "pro" | "premium";
  state: AdminPlanState;
  expiresMs: number | null;
  daysLeft: number | null;
  createdMs: number | null;
}

export interface AdminSummary {
  total: number;
  gratis: number;
  proPago: number;
  proPrueba: number;
  essentialPago: number;
  premiumPago: number;
  premiumPrueba: number;
  vencidos: number;
  porVencer7: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quién puede ver el panel: correos separados por coma en ADMIN_EMAILS. */
export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined, admins: string[]): boolean {
  return !!email && admins.includes(email.trim().toLowerCase());
}

export function classifyUser(u: AdminUserInput, nowMs: number): AdminUserRow {
  const plan = u.plan === "essential" || u.plan === "pro" || u.plan === "premium" ? u.plan : "emprendedor";
  let state: AdminPlanState = "gratis";
  let daysLeft: number | null = null;
  if (plan !== "emprendedor") {
    const active = u.expiresMs !== null && u.expiresMs > nowMs;
    state = !active ? "vencido" : u.planTrial ? "prueba" : "pago";
    if (u.expiresMs !== null) daysLeft = Math.ceil((u.expiresMs - nowMs) / DAY_MS);
  }
  return {
    uid: u.uid,
    email: u.email,
    businessName: u.businessName,
    plan,
    state,
    expiresMs: u.expiresMs,
    daysLeft,
    createdMs: u.createdMs,
  };
}

export function summarize(rows: AdminUserRow[]): AdminSummary {
  const s: AdminSummary = {
    total: rows.length,
    gratis: 0,
    proPago: 0,
    proPrueba: 0,
    essentialPago: 0,
    premiumPago: 0,
    premiumPrueba: 0,
    vencidos: 0,
    porVencer7: 0,
  };
  for (const r of rows) {
    if (r.state === "gratis") s.gratis++;
    else if (r.state === "vencido") s.vencidos++;
    else if (r.plan === "essential") { if (r.state === "pago") s.essentialPago++; }
    else if (r.plan === "pro") r.state === "pago" ? s.proPago++ : s.proPrueba++;
    else r.state === "pago" ? s.premiumPago++ : s.premiumPrueba++;
    if ((r.state === "pago" || r.state === "prueba") && r.daysLeft !== null && r.daysLeft <= 7) s.porVencer7++;
  }
  return s;
}
