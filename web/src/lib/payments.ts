"use client";

import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "./firebase";

type PayablePlan = "pro" | "premium";

interface BoldCheckoutData {
  identityKey: string;
  orderId: string;
  amount: string;
  currency: string;
  integritySignature: string;
  redirectionUrl: string;
  description: string;
}

interface BoldCheckoutConfig {
  orderId: string;
  currency: string;
  amount: string;
  apiKey: string;
  integritySignature: string;
  description: string;
  redirectionUrl: string;
}

interface BoldCheckoutInstance {
  open: () => void;
}

declare global {
  interface Window {
    BoldCheckout?: new (config: BoldCheckoutConfig) => BoldCheckoutInstance;
  }
}

const BOLD_SCRIPT_SRC = "https://checkout.bold.co/library/boldPaymentButton.js";

/** Carga el script de Bold una sola vez, sin importar cuántas veces se llame. */
function loadBoldScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.BoldCheckout) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${BOLD_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Bold.")));
      return;
    }
    const script = document.createElement("script");
    script.src = BOLD_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Bold."));
    document.head.appendChild(script);
  });
}

/**
 * Pide a la Cloud Function los datos firmados del checkout de Bold para el
 * plan elegido, y abre la pasarela de pagos usando el constructor
 * `BoldCheckout` (conserva nuestro propio botón/diseño en vez del de Bold).
 */
export async function startPlanUpgrade(plan: PayablePlan) {
  const callable = httpsCallable<
    { plan: PayablePlan; redirectionUrl: string },
    BoldCheckoutData
  >(functions, "createBoldCheckout");

  const redirectionUrl = `${window.location.origin}/upgrade/procesando/`;

  let data: BoldCheckoutData;
  try {
    const result = await callable({ plan, redirectionUrl });
    data = result.data;
  } catch (err) {
    const fnError = err as FunctionsError;
    throw new Error(traducirErrorPago(fnError));
  }

  await loadBoldScript();

  if (!window.BoldCheckout) {
    throw new Error("No se pudo iniciar Bold. Intenta de nuevo.");
  }

  const checkout = new window.BoldCheckout({
    orderId: data.orderId,
    currency: data.currency,
    amount: data.amount,
    apiKey: data.identityKey,
    integritySignature: data.integritySignature,
    description: data.description,
    redirectionUrl: data.redirectionUrl,
  });

  checkout.open();
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
