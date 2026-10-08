import type { Business } from "@/types/pinak";

/**
 * Decide qué negocio se muestra:
 *  1. el que la persona eligió la última vez (si sigue siendo suyo y no está bloqueado),
 *  2. si no, el primero propio que no esté bloqueado,
 *  3. si no, el primero que no esté bloqueado,
 *  4. si todos están bloqueados, el primero (para mostrar el aviso de plan vencido).
 */
export function pickActiveBusiness(
  businesses: Business[],
  storedId: string | null,
  uid: string | null
): Business | null {
  if (businesses.length === 0) return null;

  const usable = businesses.filter((b) => !b.locked);
  const stored = storedId ? usable.find((b) => b.id === storedId) : undefined;
  if (stored) return stored;

  return (
    usable.find((b) => b.ownerId === uid) ??
    usable[0] ??
    businesses[0]
  );
}

/** Los negocios propios primero, luego los compartidos; cada grupo del más antiguo al más nuevo. */
export function sortBusinesses(businesses: Business[], uid: string | null): Business[] {
  const time = (b: Business) => b.createdAt?.getTime() ?? 0;
  return [...businesses].sort((a, b) => {
    const ownA = a.ownerId === uid ? 0 : 1;
    const ownB = b.ownerId === uid ? 0 : 1;
    return ownA - ownB || time(a) - time(b) || a.id.localeCompare(b.id);
  });
}
