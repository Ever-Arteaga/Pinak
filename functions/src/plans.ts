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
