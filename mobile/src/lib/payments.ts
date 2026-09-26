import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "./firebase";

export type PayablePlan = "pro" | "premium";

export interface BoldCheckoutData {
  identityKey: string;
  orderId: string;
  amount: string;
  currency: string;
  integritySignature: string;
  redirectionUrl: string;
  description: string;
}

// URL pública de Firebase Hosting donde se publica la carpeta web/out
// (ver README: "firebase deploy --only hosting"). Bold exige que la URL de
// redirección empiece con https://, por eso no se puede usar un esquema
// personalizado (pinak://) aquí — el WebView detecta esta URL para saber
// cuándo cerrar y devolver el control a la app.
export const BOLD_REDIRECT_URL = "https://pinak-cd2e4.web.app/upgrade/procesando/";

/** Pide a la Cloud Function los datos firmados del checkout de Bold. */
export async function createBoldCheckout(plan: PayablePlan): Promise<BoldCheckoutData> {
  const callable = httpsCallable<
    { plan: PayablePlan; redirectionUrl: string },
    BoldCheckoutData
  >(functions, "createBoldCheckout");

  try {
    const result = await callable({ plan, redirectionUrl: BOLD_REDIRECT_URL });
    return result.data;
  } catch (err) {
    const fnError = err as FunctionsError;
    throw new Error(traducirErrorPago(fnError));
  }
}

/**
 * HTML mínimo que carga el script de Bold y abre el checkout automáticamente
 * al terminar de cargar — se usa dentro de un WebView, sin necesidad de un
 * botón intermedio (el "clic" ya ocurrió en la pantalla nativa de la app).
 */
export function buildBoldCheckoutHtml(data: BoldCheckoutData): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin:0; background:#f7f7f4; font-family:-apple-system,Helvetica,Arial,sans-serif;
             display:flex; align-items:center; justify-content:center; height:100vh; }
      p { color:#5c5f72; font-size:14px; }
    </style>
  </head>
  <body>
    <p>Cargando pago seguro...</p>
    <script src="https://checkout.bold.co/library/boldPaymentButton.js"></script>
    <script>
      window.addEventListener("load", function () {
        try {
          var checkout = new BoldCheckout({
            orderId: ${JSON.stringify(data.orderId)},
            currency: ${JSON.stringify(data.currency)},
            amount: ${JSON.stringify(data.amount)},
            apiKey: ${JSON.stringify(data.identityKey)},
            integritySignature: ${JSON.stringify(data.integritySignature)},
            description: ${JSON.stringify(data.description)},
            redirectionUrl: ${JSON.stringify(data.redirectionUrl)}
          });
          checkout.open();
        } catch (e) {
          document.body.innerHTML = "<p>No se pudo abrir el pago. Cierra e intenta de nuevo.</p>";
        }
      });
    </script>
  </body>
</html>`;
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
