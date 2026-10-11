// Meses en hora de Colombia (UTC-5 todo el año). Debe coincidir con functions/src/diagnosisStats.ts.
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

export function monthIdOf(ms: number): string {
  const d = new Date(ms - TZ_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthId(monthId: string): string {
  const [y, m] = monthId.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-10" → "octubre de 2026" */
export function monthLabel(monthId: string): string {
  const [y, m] = monthId.split("-").map(Number);
  return `${MESES[m - 1]} de ${y}`;
}
