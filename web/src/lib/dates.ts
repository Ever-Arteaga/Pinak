/**
 * Clave YYYY-MM-DD usando la zona horaria LOCAL del usuario.
 * (toISOString() usa UTC y en Colombia, UTC-5, los movimientos de la noche
 * caerían en el día siguiente.)
 */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
