/** Aviso de vencimiento del plan: se muestra a 7, 3 y 1 día del vencimiento. */

export type ExpiryLevel = 7 | 3 | 1;

export interface ExpiryNotice {
  level: ExpiryLevel;
  daysLeft: number;
  /** Cambia en cada escalón (7 → 3 → 1) y con cada renovación: sirve para "descartar" un aviso. */
  key: string;
  title: string;
  body: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function expiryNotice(
  input: { plan: string; planTrial: boolean; expiresMs: number | null },
  nowMs: number = Date.now()
): ExpiryNotice | null {
  if (input.plan !== "essential" && input.plan !== "pro" && input.plan !== "premium") return null;
  if (input.expiresMs === null || input.expiresMs <= nowMs) return null;
  const daysLeft = Math.ceil((input.expiresMs - nowMs) / DAY_MS);
  if (daysLeft > 7) return null;
  const level: ExpiryLevel = daysLeft <= 1 ? 1 : daysLeft <= 3 ? 3 : 7;
  const nombre = input.plan === "essential" ? "Essential" : input.plan === "pro" ? "Pro" : "Premium";
  const cuando = daysLeft <= 1 ? "mañana" : `en ${daysLeft} días`;
  const title = input.planTrial
    ? `Tu prueba de ${nombre} termina ${cuando}`
    : `Tu plan ${nombre} vence ${cuando}`;
  const body = input.planTrial
    ? "Al terminar volverás al plan gratis. Elige un plan para no perder las funciones."
    : "Renueva ahora para no perder tus funciones. Si pagas antes, se suman los 30 días al vencimiento actual y no pierdes ninguno.";
  return { level, daysLeft, key: `${input.expiresMs}:${level}`, title, body };
}
