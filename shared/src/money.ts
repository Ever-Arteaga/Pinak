/** Deja solo dígitos (los montos en COP no llevan decimales). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
}

/** 50000 → "50.000" */
export function formatThousands(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const MAX_AMOUNT = 1_000_000_000;
