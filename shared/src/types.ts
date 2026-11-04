import type { BillingConfig } from "./billing";

// Tipos de dominio compartidos para PINAK

export type Plan = "emprendedor" | "essential" | "pro" | "premium";

export type TransactionType = "ingreso" | "egreso";

export type PaymentMethod =
  | "efectivo"
  | "nequi"
  | "daviplata"
  | "tarjeta"
  | "transferencia";

export interface PinakUser {
  uid: string;
  email: string;
  businessName: string;
  businessType?: string;
  phone?: string;
  city?: string;
  nit?: string;
  description?: string;
  plan: Plan;
  planStartedAt: Date;
  createdAt: Date;
  privacyModeEnabled?: boolean;
}

export const BUSINESS_TYPES = [
  "Tienda / Minimercado",
  "Restaurante / Comida",
  "Ropa y accesorios",
  "Belleza y cuidado personal",
  "Ferretería",
  "Papelería",
  "Servicios profesionales",
  "Tecnología",
  "Otro",
] as const;

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  method: PaymentMethod;
  description?: string;
  date: Date;
  source: "manual" | "ia_voz" | "ia_texto";
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface Receivable {
  id: string;
  clientName: string;
  clientPhone?: string;
  amount: number;
  status: "pendiente" | "pagado" | "vencido";
  dueDate?: Date;
  createdAt: Date;
}

/** Tipos de negocio que normalmente atienden con citas (la agenda se les sugiere). */
export const APPOINTMENT_TYPES: readonly string[] = ["Belleza y cuidado personal", "Servicios profesionales", "Tecnología"];

export type AppointmentStatus = "agendada" | "atendida" | "cancelada";

export interface Appointment {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceName: string;
  price: number;
  start: Date;
  durationMin: number;
  status: AppointmentStatus;
  paid: boolean;
  /** Recibo con el que se cobró la cita. */
  receiptId?: string;
  notes?: string;
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  /** NIT o cédula. */
  document?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
}

export type ProductKind = "producto" | "servicio";

export interface Product {
  id: string;
  name: string;
  price: number;
  kind: ProductKind;
  createdAt: Date;
}

export interface ReceiptItem {
  name: string;
  qty: number;
  /** Precio unitario. En una factura es SIN IVA. */
  price: number;
  /** Unidad de medida (UND, KG, HORA...). */
  unit?: string;
  /** Tarifa de IVA en %: 0, 5 o 19. */
  ivaRate?: number;
}

export type QuoteStatus = "pendiente" | "aceptada" | "rechazada";

export interface QuoteItem {
  name: string;
  qty: number;
  /** Precio unitario. */
  price: number;
}

/** Cotización: propuesta de precios numerada (COT-000001). No es una factura ni un comprobante de pago. */
export interface Quote {
  id: string;
  number: number;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerDocument?: string;
  items: QuoteItem[];
  total: number;
  status: QuoteStatus;
  /** Hasta cuándo es válida la oferta. */
  validUntil: Date;
  notes?: string;
  /** Recibo con el que se cerró la venta, si se convirtió. */
  receiptId?: string;
  date: Date;
  createdAt: Date;
}

/** Recibo de venta: comprobante interno numerado (no es factura electrónica de la DIAN). */
export interface Receipt {
  id: string;
  number: number;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerDocument?: string;
  items: ReceiptItem[];
  total: number;
  method: PaymentMethod;
  status: "pagado" | "pendiente";
  notes?: string;
  date: Date;
  createdAt: Date;
  /** "factura" = factura de venta con autorización de numeración; sin valor = recibo interno. */
  docType?: "recibo" | "factura";
  prefix?: string;
  subtotal?: number;
  ivaTotal?: number;
  /** Fecha límite si se vendió a crédito. */
  dueDate?: Date;
  /** Copia de los datos fiscales vigentes al emitirla. */
  fiscal?: ReceiptFiscal;
  /** Ingreso o fiado que se registró junto con el documento. */
  transactionId?: string;
  receivableId?: string;
}

export interface ReceiptFiscal {
  resolutionNumber: string;
  resolutionDate: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  validUntil: string;
  taxStatus: string;
  taxNote: string;
}

export const DEFAULT_CATEGORIES: Array<Pick<Category, "name" | "type" | "icon">> = [
  { name: "Ventas", type: "ingreso", icon: "💰" },
  { name: "Servicios", type: "ingreso", icon: "🧾" },
  { name: "Otros ingresos", type: "ingreso", icon: "➕" },
  { name: "Insumos", type: "egreso", icon: "📦" },
  { name: "Arriendo", type: "egreso", icon: "🏠" },
  { name: "Nómina", type: "egreso", icon: "👥" },
  { name: "Servicios públicos", type: "egreso", icon: "💡" },
  { name: "Transporte", type: "egreso", icon: "🚚" },
  { name: "Otros gastos", type: "egreso", icon: "➖" },
];

export interface PlanConfig {
  users: number; // usuarios por negocio, incluyendo al dueño
  businesses: number; // negocios que puede tener la cuenta
  aiEnabled: boolean;
  aiRegistrationsPerMonth: number | null; // null = ilimitado
  exports: boolean; // exportar reportes a PDF y Excel
  diagnosis: boolean; // diagnóstico financiero mensual con IA
  privacyMode: boolean; // oculta montos en pantalla
  invoicing: boolean; // recibos de venta, clientes y catálogo
  agenda: boolean; // agenda de citas con cobro
  priceCOP: number;
}

// Estos límites deben coincidir con functions/src/plans.ts, que es quien los aplica de verdad.
export const PLAN_LIMITS: Record<Plan, PlanConfig> = {
  emprendedor: {
    users: 1, businesses: 1, aiEnabled: false, aiRegistrationsPerMonth: 0,
    exports: false, diagnosis: false, privacyMode: false, invoicing: false, agenda: false, priceCOP: 0,
  },
  essential: {
    users: 1, businesses: 1, aiEnabled: true, aiRegistrationsPerMonth: null,
    exports: true, diagnosis: false, privacyMode: false, invoicing: false, agenda: false, priceCOP: 19900,
  },
  pro: {
    users: 2, businesses: 1, aiEnabled: true, aiRegistrationsPerMonth: null,
    exports: true, diagnosis: false, privacyMode: false, invoicing: false, agenda: false, priceCOP: 39900,
  },
  premium: {
    users: Infinity, businesses: Infinity, aiEnabled: true, aiRegistrationsPerMonth: null,
    exports: true, diagnosis: true, privacyMode: true, invoicing: true, agenda: true, priceCOP: 69900,
  },
};

export const PLAN_NAMES: Record<Plan, string> = {
  emprendedor: "Emprendedor",
  essential: "Essential",
  pro: "Pro",
  premium: "Premium",
};

// ---------------------------------------------------------------------------
// Negocios y equipos
// ---------------------------------------------------------------------------
export type BusinessRole = "owner" | "member";

export interface BusinessMember {
  uid: string;
  role: BusinessRole;
  email: string;
  joinedAt: Date | null;
}

export interface Business {
  id: string;
  name: string;
  businessType: string;
  phone: string;
  city: string;
  nit: string;
  description: string;
  /** Respuesta del cuestionario: ¿atiende con citas? Sin responder = undefined. */
  usesAppointments?: boolean;
  /** Datos de facturación (resolución de numeración, régimen de IVA...). */
  billing?: BillingConfig;
  /** Foto del negocio: imagen pequeña (JPEG ~256 px) como data URL. */
  photoURL: string;
  ownerId: string;
  plan: Plan; // plan del DUEÑO: lo heredan todas las personas del negocio
  locked: boolean; // true si el plan del dueño venció y este negocio ya no cabe
  members: BusinessMember[];
  createdAt: Date | null;
}

export interface Invitation {
  id: string;
  businessId: string;
  businessName: string;
  email: string;
  invitedByEmail: string;
  status: "pendiente" | "aceptada" | "rechazada";
}

// ---------------------------------------------------------------------------
// Diagnóstico financiero
// ---------------------------------------------------------------------------
export interface CategoryShare {
  category: string;
  amount: number;
  pct: number;
}

export interface DiagnosisStats {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  marginPct: number | null;
  txCount: number;
  topExpenseCategories: CategoryShare[];
  topIncomeCategories: CategoryShare[];
  previous: { income: number; expenses: number; balance: number } | null;
  change: { incomePct: number | null; expensesPct: number | null } | null;
  receivables: {
    pendingCount: number;
    pendingTotal: number;
    overdueCount: number;
    overdueTotal: number;
    oldestOverdueDays: number | null;
  };
}

export interface Diagnosis {
  month: string;
  resumen: string;
  hallazgos: string[];
  recomendaciones: string[];
  alerta: string | null;
  stats: DiagnosisStats;
  generationCount: number;
  generatedAt: Date | null;
}

/** Resumen agregado de un día, un mes o todo el historial (lo mantiene el servidor). */
export interface Summary {
  income: number;
  expense: number;
  count: number;
  aiCount: number;
  expenseByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  incomeByMethod: Record<string, number>;
}
