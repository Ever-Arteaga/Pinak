/**
 * Reglas de negocio de los planes, sin ninguna dependencia de Firebase:
 * todo son funciones puras para poder probarlas a fondo.
 *
 * Los beneficios de un negocio los define el plan de su DUEÑO (quien paga).
 * Las personas invitadas heredan esos beneficios dentro de ese negocio.
 */

export type Plan = "emprendedor" | "pro" | "premium";

export interface PlanLimits {
  /** Usuarios por negocio, incluyendo al dueño. null = ilimitado. */
  users: number | null;
  /** Negocios que puede tener una cuenta. null = ilimitado. */
  businesses: number | null;
  ai: boolean;
  exports: boolean;
  diagnosis: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  emprendedor: { users: 1, businesses: 1, ai: false, exports: false, diagnosis: false },
  pro: { users: 2, businesses: 1, ai: true, exports: true, diagnosis: false },
  premium: { users: null, businesses: null, ai: true, exports: true, diagnosis: true },
};

/** Tope diario de registros con IA por negocio (protege el costo de Gemini). */
export const AI_DAILY_CAP: Record<Plan, number> = { emprendedor: 0, pro: 200, premium: 500 };

export const PLAN_NAMES: Record<Plan, string> = {
  emprendedor: "Emprendedor",
  pro: "Pro",
  premium: "Premium",
};

export function normalizePlan(value: unknown): Plan {
  return value === "pro" || value === "premium" ? value : "emprendedor";
}

export function limitReached(limit: number | null, current: number): boolean {
  return limit !== null && current >= limit;
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type RefusalCode =
  | "invalid-argument"
  | "permission-denied"
  | "already-exists"
  | "resource-exhausted"
  | "failed-precondition";

export interface Refusal {
  code: RefusalCode;
  message: string;
}

// ---------------------------------------------------------------------------
// Crear un negocio nuevo
// ---------------------------------------------------------------------------
export function createBusinessDecision(input: {
  plan: Plan;
  ownedCount: number;
  name: string;
}): Refusal | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    return { code: "invalid-argument", message: "El nombre del negocio debe tener entre 2 y 80 caracteres." };
  }
  if (limitReached(PLAN_LIMITS[input.plan].businesses, input.ownedCount)) {
    return {
      code: "resource-exhausted",
      message: "Tu plan incluye 1 negocio. Con el plan Premium puedes administrar varios.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Invitar a una persona al negocio
// ---------------------------------------------------------------------------
export function inviteDecision(input: {
  plan: Plan;
  email: string; // ya normalizado
  ownerEmail: string;
  memberEmails: string[]; // en minúsculas
  memberCount: number; // incluye al dueño
  pendingEmails: string[]; // invitaciones pendientes, en minúsculas
}): Refusal | null {
  if (!isValidEmail(input.email)) {
    return { code: "invalid-argument", message: "Escribe un correo válido." };
  }
  if (input.email === input.ownerEmail.toLowerCase() || input.memberEmails.includes(input.email)) {
    return { code: "already-exists", message: "Esa persona ya es parte de este negocio." };
  }
  if (input.pendingEmails.includes(input.email)) {
    return { code: "already-exists", message: "Ya enviaste una invitación a ese correo." };
  }
  const limit = PLAN_LIMITS[input.plan].users;
  // Las invitaciones pendientes cuentan: así no se puede superar el límite
  // enviando varias invitaciones a la vez y aceptándolas después.
  if (limitReached(limit, input.memberCount + input.pendingEmails.length)) {
    return {
      code: "resource-exhausted",
      message:
        input.plan === "emprendedor"
          ? "El plan Emprendedor incluye 1 usuario. Mejora a Pro para invitar a otra persona."
          : `El plan ${PLAN_NAMES[input.plan]} permite hasta ${limit} usuarios, contándote a ti.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aceptar una invitación
// ---------------------------------------------------------------------------
export function acceptDecision(input: {
  inviteStatus: string;
  inviteEmail: string;
  tokenEmail: string;
  emailVerified: boolean;
  alreadyMember: boolean;
  businessLocked: boolean;
  plan: Plan;
  memberCount: number;
}): Refusal | null {
  if (input.inviteStatus !== "pendiente") {
    return { code: "failed-precondition", message: "Esta invitación ya no está disponible." };
  }
  // Sin correo verificado, cualquiera podría registrarse con el correo de otra
  // persona y apropiarse de su invitación.
  if (!input.emailVerified) {
    return {
      code: "failed-precondition",
      message: "Verifica tu correo electrónico para poder aceptar la invitación.",
    };
  }
  if (normalizeEmail(input.tokenEmail) !== normalizeEmail(input.inviteEmail)) {
    return { code: "permission-denied", message: "Esta invitación es para otro correo." };
  }
  if (input.alreadyMember) {
    return { code: "already-exists", message: "Ya eres parte de este negocio." };
  }
  if (input.businessLocked) {
    return {
      code: "failed-precondition",
      message: "Este negocio está bloqueado porque su plan venció. Pídele al dueño que lo renueve.",
    };
  }
  if (limitReached(PLAN_LIMITS[input.plan].users, input.memberCount)) {
    return {
      code: "resource-exhausted",
      message: "Este negocio ya alcanzó el máximo de usuarios de su plan.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Quitar a alguien (o salirse uno mismo)
// ---------------------------------------------------------------------------
export function removeDecision(input: {
  actorUid: string;
  ownerId: string;
  targetUid: string;
  targetIsMember: boolean;
}): Refusal | null {
  if (!input.targetIsMember) {
    return { code: "failed-precondition", message: "Esa persona no es parte del negocio." };
  }
  if (input.targetUid === input.ownerId) {
    return { code: "permission-denied", message: "El dueño no puede salir ni ser quitado de su negocio." };
  }
  const actorIsOwner = input.actorUid === input.ownerId;
  const leavingSelf = input.actorUid === input.targetUid;
  if (!actorIsOwner && !leavingSelf) {
    return { code: "permission-denied", message: "Solo el dueño puede quitar a otras personas." };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Al cambiar el plan de un dueño: qué negocios quedan activos o bloqueados y
// qué personas dejan de caber en el límite de usuarios.
// ---------------------------------------------------------------------------
export interface OwnedBusinessInfo {
  id: string;
  createdAtMs: number;
  /** Personas del negocio EXCLUYENDO al dueño. */
  members: { uid: string; joinedAtMs: number }[];
}

export interface TrimResult {
  unlock: string[];
  lock: string[];
  removeMembers: { businessId: string; uids: string[] }[];
}

export function planTrim(businesses: OwnedBusinessInfo[], plan: Plan): TrimResult {
  const limits = PLAN_LIMITS[plan];
  const sorted = [...businesses].sort(
    (a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id)
  );

  const keepBusinesses = limits.businesses === null ? sorted.length : limits.businesses;
  const active = sorted.slice(0, keepBusinesses);
  const locked = sorted.slice(keepBusinesses);

  const removeMembers: TrimResult["removeMembers"] = [];
  if (limits.users !== null) {
    // El dueño ocupa 1 lugar; el resto del cupo es para invitados.
    const guestSlots = Math.max(0, limits.users - 1);
    for (const b of active) {
      const byAntiquity = [...b.members].sort(
        (x, y) => x.joinedAtMs - y.joinedAtMs || x.uid.localeCompare(y.uid)
      );
      const excess = byAntiquity.slice(guestSlots);
      if (excess.length > 0) {
        removeMembers.push({ businessId: b.id, uids: excess.map((m) => m.uid) });
      }
    }
  }

  return {
    unlock: active.map((b) => b.id),
    lock: locked.map((b) => b.id),
    removeMembers,
  };
}

// ---------------------------------------------------------------------------
// Prueba gratuita de 15 días (una vez por plan y por cuenta)
// ---------------------------------------------------------------------------
export const TRIAL_DAYS = 15;

export function trialDecision(input: {
  target: unknown;
  currentPlan: Plan;
  currentIsTrial: boolean;
  trialsUsed: Partial<Record<Plan, boolean>>;
}): Refusal | null {
  if (input.target !== "pro" && input.target !== "premium") {
    return { code: "invalid-argument", message: "Plan no válido para la prueba gratuita." };
  }
  const target: Plan = input.target;
  if (input.trialsUsed[target]) {
    return { code: "already-exists", message: `Ya usaste tu prueba gratuita del plan ${PLAN_NAMES[target]}.` };
  }
  if (input.currentPlan === target) {
    return { code: "failed-precondition", message: `Ya tienes el plan ${PLAN_NAMES[target]}.` };
  }
  if (input.currentPlan !== "emprendedor" && !input.currentIsTrial) {
    return { code: "failed-precondition", message: "Ya tienes un plan de pago activo." };
  }
  if (input.currentPlan === "premium") {
    return { code: "failed-precondition", message: "Ya estás probando un plan superior." };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pagos: qué pasa con el plan del usuario cuando Bold aprueba una venta
// ---------------------------------------------------------------------------
export const PLAN_RANK: Record<Plan, number> = { emprendedor: 0, pro: 1, premium: 2 };
export const PAID_PLAN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PendingPlan {
  plan: "pro" | "premium";
  /** Cuándo empieza a regir (el vencimiento del plan superior vigente). */
  startMs: number;
  days: number;
}

export interface PaymentState {
  plan: Plan;
  trial: boolean;
  expiresMs: number | null;
  pending: PendingPlan | null;
}

export interface PaymentResult {
  plan: Plan;
  expiresMs: number | null;
  pending: PendingPlan | null;
  /** true si se aplicó ahora; false si quedó como crédito pendiente. */
  appliedNow: boolean;
}

/** Plan de pago vigente (no prueba, no vencido), o null. */
function activePaid(s: PaymentState, nowMs: number): { plan: "pro" | "premium"; expiresMs: number } | null {
  if (s.plan === "emprendedor" || s.trial) return null;
  if (s.expiresMs === null || s.expiresMs <= nowMs) return null;
  return { plan: s.plan, expiresMs: s.expiresMs };
}

export function paymentDecision(input: {
  nowMs: number;
  state: PaymentState;
  paid: "pro" | "premium";
  days?: number;
}): PaymentResult {
  const days = input.days ?? PAID_PLAN_DAYS;
  const { nowMs, state, paid } = input;
  const active = activePaid(state, nowMs);

  if (active && PLAN_RANK[active.plan] > PLAN_RANK[paid]) {
    // Pagó un plan inferior al que ya tiene vigente: no se baja; queda como crédito.
    const sameCredit = state.pending && state.pending.plan === paid;
    return {
      plan: state.plan,
      expiresMs: state.expiresMs,
      pending: { plan: paid, startMs: active.expiresMs, days: (sameCredit ? state.pending!.days : 0) + days },
      appliedNow: false,
    };
  }
  if (active && active.plan === paid) {
    // Renovación anticipada: suma desde el vencimiento actual.
    return { plan: paid, expiresMs: active.expiresMs + days * DAY_MS, pending: state.pending, appliedNow: true };
  }
  // Sin plan de pago vigente, en prueba, o plan superior: empieza desde ahora.
  return { plan: paid, expiresMs: nowMs + days * DAY_MS, pending: null, appliedNow: true };
}

/**
 * Al vencer el plan: si hay un crédito pendiente se activa; si no, vuelve a gratis.
 */
export function expiryDecision(input: {
  nowMs: number;
  pending: PendingPlan | null;
}): { plan: Plan; expiresMs: number | null; pending: null } {
  if (!input.pending) return { plan: "emprendedor", expiresMs: null, pending: null };
  const start = Math.max(input.pending.startMs, input.nowMs);
  return { plan: input.pending.plan, expiresMs: start + input.pending.days * DAY_MS, pending: null };
}
