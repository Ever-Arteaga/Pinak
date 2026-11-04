/** Datos de facturación de un negocio y cálculo de impuestos de un documento de venta. */

export type TaxStatus = "no_responsable" | "responsable_iva" | "simple";
export type DocType = "recibo" | "factura";

export const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  no_responsable: "No responsable de IVA",
  responsable_iva: "Responsable de IVA",
  simple: "Régimen SIMPLE de tributación",
};

export const IVA_RATES = [0, 5, 19] as const;

export interface BillingConfig {
  /** Qué documento se propone por defecto al vender. */
  mode: DocType;
  taxStatus: TaxStatus;
  /** Calidad tributaria adicional: agente retenedor, gran contribuyente, autorretenedor... */
  taxNote: string;
  /** Autorización de numeración de la DIAN. */
  resolutionNumber: string;
  resolutionDate: string; // AAAA-MM-DD
  prefix: string; // hasta 4 caracteres
  rangeFrom: number;
  rangeTo: number;
  validUntil: string; // AAAA-MM-DD
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBilling(raw: unknown): BillingConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const x = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const taxStatus: TaxStatus =
    x.taxStatus === "responsable_iva" || x.taxStatus === "simple" ? x.taxStatus : "no_responsable";
  return {
    mode: x.mode === "factura" ? "factura" : "recibo",
    taxStatus,
    taxNote: str(x.taxNote),
    resolutionNumber: str(x.resolutionNumber),
    resolutionDate: str(x.resolutionDate),
    prefix: str(x.prefix),
    rangeFrom: num(x.rangeFrom),
    rangeTo: num(x.rangeTo),
    validUntil: str(x.validUntil),
  };
}

/** Fin del día (hora local) de una fecha AAAA-MM-DD, o null si no es válida. */
export function endOfDayMs(date: string): number | null {
  if (!DATE_RE.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 23, 59, 59);
  return Number.isNaN(dt.getTime()) || dt.getMonth() !== m - 1 ? null : dt.getTime();
}

/** Qué le falta o qué está mal en la autorización de numeración. Lista vacía = se puede facturar. */
export function billingProblems(b: BillingConfig | undefined, nextNumber: number | null, nowMs: number = Date.now()): string[] {
  const out: string[] = [];
  if (!b) return ["Configura los datos de facturación en tu perfil."];
  if (!b.resolutionNumber.trim()) out.push("Falta el número de la resolución de autorización de numeración.");
  if (endOfDayMs(b.resolutionDate) === null) out.push("Falta la fecha de la resolución.");
  if (b.prefix.length > 4) out.push("El prefijo puede tener máximo 4 caracteres.");
  if (!Number.isInteger(b.rangeFrom) || !Number.isInteger(b.rangeTo) || b.rangeFrom < 1 || b.rangeTo < b.rangeFrom) {
    out.push("El rango de numeración no es válido.");
  }
  const until = endOfDayMs(b.validUntil);
  if (until === null) out.push("Falta la fecha de vigencia de la numeración.");
  else if (until < nowMs) out.push("La autorización de numeración está vencida. Solicita una nueva a la DIAN.");
  if (nextNumber !== null && Number.isInteger(b.rangeTo) && b.rangeTo >= b.rangeFrom && nextNumber > b.rangeTo) {
    out.push("Se agotó el rango de numeración autorizado. Solicita una nueva numeración a la DIAN.");
  }
  return out;
}

export interface TaxLine {
  qty: number;
  price: number;
  ivaRate?: number;
}

export interface DocTotals {
  subtotal: number;
  ivaByRate: Record<number, number>;
  ivaTotal: number;
  total: number;
}

/** Subtotal, IVA por tarifa y total. El precio de cada línea es SIN IVA; el IVA se suma. */
export function docTotals(lines: TaxLine[]): DocTotals {
  let subtotal = 0;
  let ivaTotal = 0;
  const ivaByRate: Record<number, number> = {};
  for (const l of lines) {
    const base = Math.round(l.qty * l.price);
    subtotal += base;
    const rate = l.ivaRate ?? 0;
    if (rate > 0) {
      const iva = Math.round((base * rate) / 100);
      ivaTotal += iva;
      ivaByRate[rate] = (ivaByRate[rate] ?? 0) + iva;
    }
  }
  return { subtotal, ivaByRate, ivaTotal, total: subtotal + ivaTotal };
}

/** Número como se imprime: con prefijo si lo tiene (p. ej. "SETT-000123"). */
export function formatDocNumber(number: number, prefix?: string): string {
  const n = String(number).padStart(6, "0");
  return prefix ? `${prefix}-${n}` : n;
}
