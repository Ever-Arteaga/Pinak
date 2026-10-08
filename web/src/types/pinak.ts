// Tipos de dominio compartidos para PINAK

export type Plan = "emprendedor" | "pro" | "premium";

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
  priceCOP: number;
}

// Estos límites deben coincidir con functions/src/plans.ts, que es quien los aplica de verdad.
export const PLAN_LIMITS: Record<Plan, PlanConfig> = {
  emprendedor: {
    users: 1, businesses: 1, aiEnabled: false, aiRegistrationsPerMonth: 0,
    exports: false, diagnosis: false, privacyMode: false, priceCOP: 0,
  },
  pro: {
    users: 2, businesses: 1, aiEnabled: true, aiRegistrationsPerMonth: null,
    exports: true, diagnosis: false, privacyMode: false, priceCOP: 39900,
  },
  premium: {
    users: Infinity, businesses: Infinity, aiEnabled: true, aiRegistrationsPerMonth: null,
    exports: true, diagnosis: true, privacyMode: true, priceCOP: 69900,
  },
};

export const PLAN_NAMES: Record<Plan, string> = {
  emprendedor: "Emprendedor",
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
