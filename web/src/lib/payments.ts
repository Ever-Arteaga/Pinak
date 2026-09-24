"use client";

import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "./firebase";

type PayablePlan = "pro" | "premium";

interface CheckoutResult {
  checkoutUrl: string;
  reference: string;
}

/**
 * Pide a la Cloud Function un checkout de Wompi para actualizar de plan,
 * y redirige al navegador ahí mismo.
 */
export async function startPlanUpgrade(plan: PayablePlan) {
  const callable = httpsCallable<
    { plan: PayablePlan; redirectUrl: string },
    CheckoutResult
  >(functions, "createUpgradeCheckout");

  const redirectUrl = `${window.location.origin}/upgrade/procesando`;

  try {
    const result = await callable({ plan, redirectUrl });
    window.location.href = result.data.checkoutUrl;
  } catch (err) {
    const fnError = err as FunctionsError;
    throw new Error(traducirErrorPago(fnError));
  }
}

function traducirErrorPago(err: FunctionsError): string {
  switch (err.code) {
    case "functions/unauthenticated":
      return "Tu sesión expiró, vuelve a iniciar sesión.";
    case "functions/invalid-argument":
      return err.message || "Datos de pago inválidos.";
    default:
      return "No se pudo iniciar el pago. Intenta de nuevo.";
  }
}
