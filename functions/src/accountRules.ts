/** Reglas puras del borrado de cuenta (se prueban sin Firebase). */

/** Cuánto tiempo después de iniciar sesión se permite borrar la cuenta. */
export const RECENT_LOGIN_MS = 5 * 60 * 1000;

/** Frase que la persona debe escribir para confirmar el borrado. */
export const DELETE_CONFIRMATION = "ELIMINAR";

/** true si el inicio de sesión (auth_time, en segundos) es reciente. */
export function isRecentLogin(authTimeSec: unknown, nowMs: number, maxAgeMs = RECENT_LOGIN_MS): boolean {
  if (typeof authTimeSec !== "number" || !Number.isFinite(authTimeSec)) return false;
  const age = nowMs - authTimeSec * 1000;
  return age >= -60_000 && age <= maxAgeMs; // 1 min de tolerancia por desfase de reloj
}

/** La confirmación debe ser exactamente la frase (sin importar mayúsculas ni espacios). */
export function isDeleteConfirmed(input: unknown): boolean {
  return typeof input === "string" && input.trim().toUpperCase() === DELETE_CONFIRMATION;
}
