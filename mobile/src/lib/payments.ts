import { httpsCallable, type FunctionsError } from "firebase/functions";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { functions } from "./firebase";

type PayablePlan = "pro" | "premium";

interface CheckoutResult {
  checkoutUrl: string;
  reference: string;
}

/**
 * Pide a la Cloud Function un checkout de Wompi para actualizar de plan,
 * y lo abre en el navegador del dispositivo. El usuario vuelve a la app
 * sola (deep link "pinak://upgrade-success") cuando termina de pagar;
 * la confirmación real del plan llega poco después vía el webhook de Wompi,
 * que useUserProfile detecta en tiempo real.
 */
export async function startPlanUpgrade(plan: PayablePlan) {
  const callable = httpsCallable<
    { plan: PayablePlan; redirectUrl: string },
    CheckoutResult
  >(functions, "createUpgradeCheckout");

  const redirectUrl = Linking.createURL("upgrade-success");

  try {
    const result = await callable({ plan, redirectUrl });
    await WebBrowser.openBrowserAsync(result.data.checkoutUrl);
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
