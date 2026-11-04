"use client";

import { useBusiness } from "./business";

/**
 * Las cuentas con plan Essential son personales (no tienen negocio): la app les habla de
 * "tu cuenta" y de tus finanzas, no de clientes, ventas ni negocios.
 */
export function usePersonal(): boolean {
  const { business } = useBusiness();
  return business?.plan === "essential";
}
