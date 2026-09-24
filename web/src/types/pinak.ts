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
  plan: Plan;
  planStartedAt: Date;
  createdAt: Date;
  privacyModeEnabled?: boolean;
}

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
  users: number;
  aiEnabled: boolean;
  aiRegistrationsPerMonth: number | null; // null = ilimitado
  priceCOP: number;
}

export const PLAN_LIMITS: Record<Plan, PlanConfig> = {
  emprendedor: { users: 1, aiEnabled: false, aiRegistrationsPerMonth: 0, priceCOP: 0 },
  pro: { users: 2, aiEnabled: true, aiRegistrationsPerMonth: null, priceCOP: 39900 },
  premium: { users: Infinity, aiEnabled: true, aiRegistrationsPerMonth: null, priceCOP: 69900 },
};
