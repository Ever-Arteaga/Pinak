// Tipos de dominio compartidos para PINAK

export type Plan = "emprendedor" | "estandar" | "pro";

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

export const PLAN_LIMITS: Record<Plan, { users: number; aiRegistrationsPerMonth: number | null }> = {
  emprendedor: { users: 1, aiRegistrationsPerMonth: 3 },
  estandar: { users: 2, aiRegistrationsPerMonth: null },
  pro: { users: Infinity, aiRegistrationsPerMonth: null },
};
