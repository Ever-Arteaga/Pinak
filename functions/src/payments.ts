import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// Llaves de Bold guardadas como secretos de Firebase — nunca en el código ni el cliente.
// Se configuran una sola vez con:
//   firebase functions:secrets:set BOLD_IDENTITY_KEY
//   firebase functions:secrets:set BOLD_SECRET_KEY
// (Ambas llaves están en el Panel de Comercios de Bold, sección "Botón de pagos".
// La "llave de identidad" es pública; la "llave secreta" NUNCA debe exponerse al cliente.)
const boldIdentityKey = defineSecret("BOLD_IDENTITY_KEY");
const boldSecretKey = defineSecret("BOLD_SECRET_KEY");

type PayablePlan = "pro" | "premium";

// Precios en pesos colombianos, sin decimales (así los pide Bold, a diferencia
// de otras pasarelas que piden el monto en "centavos").
const PLAN_PRICES_COP: Record<PayablePlan, number> = {
  pro: 39900,
  premium: 69900,
};

const PLAN_DURATION_DAYS = 30;

/**
 * Genera los datos firmados que el cliente necesita para abrir el checkout
 * de Bold (usando su constructor `BoldCheckout` en el navegador/WebView).
 * Guarda también la "intención de compra" en Firestore para que el webhook
 * sepa, con solo el orderId, a qué usuario y plan corresponde el pago.
 */
export const createBoldCheckout = onCall(
  { secrets: [boldIdentityKey, boldSecretKey], region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para actualizar tu plan.");
    }

    const uid = request.auth.uid;
    const plan = request.data?.plan as PayablePlan;
    const redirectionUrl = (request.data?.redirectionUrl ?? "").toString();

    if (plan !== "pro" && plan !== "premium") {
      throw new HttpsError("invalid-argument", "Plan inválido. Usa 'pro' o 'premium'.");
    }
    if (!redirectionUrl.startsWith("https://")) {
      throw new HttpsError("invalid-argument", "La URL de redirección debe empezar con https://.");
    }

    const amount = PLAN_PRICES_COP[plan]; // pesos colombianos, sin decimales
    const currency = "COP";
    const orderId = `pinak-${crypto.randomBytes(8).toString("hex")}-${Date.now()}`;

    // Guarda la intención de compra para que el webhook, que solo recibe el
    // orderId de vuelta, pueda saber a qué usuario/plan corresponde.
    await db.collection("checkoutIntents").doc(orderId).set({
      uid,
      plan,
      amount,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Firma de integridad exigida por Bold: SHA256(orderId + monto + moneda + llave secreta)
    const integritySignature = crypto
      .createHash("sha256")
      .update(`${orderId}${amount}${currency}${boldSecretKey.value()}`)
      .digest("hex");

    logger.info("Checkout de Bold generado", { uid, plan, orderId });

    return {
      identityKey: boldIdentityKey.value(),
      orderId,
      amount: String(amount),
      currency,
      integritySignature,
      redirectionUrl,
      description: `PINAK - Plan ${plan === "pro" ? "Pro" : "Premium"}`,
    };
  }
);

/**
 * Endpoint público que recibe las notificaciones de Bold cuando una venta
 * cambia de estado. Verifica la firma HMAC del evento y, si fue aprobada,
 * actualiza el plan del usuario usando permisos de administrador (el cliente
 * nunca puede cambiar su propio plan directamente — ver firestore.rules).
 */
export const boldWebhook = onRequest(
  { secrets: [boldSecretKey], region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // La verificación de firma de Bold exige el cuerpo CRUDO de la petición
    // (sin parsear), codificado en Base64. Firebase Functions siempre expone
    // el buffer original en req.rawBody, incluso cuando también parsea el
    // JSON en req.body por conveniencia.
    const rawBody = req.rawBody;
    const receivedSignature = req.header("x-bold-signature") ?? "";

    const expectedSignature = crypto
      .createHmac("sha256", boldSecretKey.value())
      .update(rawBody.toString("base64"))
      .digest("hex");

    const validSignature =
      receivedSignature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));

    if (!validSignature) {
      logger.error("Firma de webhook de Bold inválida — posible solicitud falsa");
      res.status(401).send("invalid signature");
      return;
    }

    const body = req.body as {
      type?: string;
      data?: {
        payment_id?: string;
        amount?: { total?: number; currency?: string };
        metadata?: { reference?: string | null };
      };
    };

    // Solo nos interesan las ventas aprobadas; respondemos 200 al resto para
    // que Bold no reintente notificaciones que no vamos a procesar.
    if (body.type !== "SALE_APPROVED") {
      res.status(200).send("ignored");
      return;
    }

    const reference = body.data?.metadata?.reference;
    if (!reference) {
      logger.warn("Notificación de Bold sin referencia, ignorada");
      res.status(200).send("no reference");
      return;
    }

    const intentRef = db.collection("checkoutIntents").doc(reference);
    const intentSnap = await intentRef.get();

    if (!intentSnap.exists) {
      logger.error("Referencia de Bold no encontrada en checkoutIntents", { reference });
      res.status(200).send("unknown reference");
      return;
    }

    const intent = intentSnap.data() as {
      uid: string;
      plan: PayablePlan;
      amount: number;
      status: string;
    };

    // Idempotencia: si ya procesamos este pago antes (reintento de Bold), no
    // lo volvemos a aplicar, pero igual confirmamos recepción con 200.
    if (intent.status === "completed") {
      res.status(200).send("already processed");
      return;
    }

    const paidAmount = body.data?.amount?.total;
    if (paidAmount !== intent.amount) {
      logger.error("El monto pagado no coincide con el esperado — posible manipulación", {
        reference,
        esperado: intent.amount,
        recibido: paidAmount,
      });
      res.status(200).send("amount mismatch, not granting plan");
      return;
    }

    const planExpiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    await db.doc(`users/${intent.uid}`).set(
      { plan: intent.plan, planExpiresAt, planUpdatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    await db.doc(`users/${intent.uid}/payments/${body.data?.payment_id ?? reference}`).set({
      plan: intent.plan,
      amount: paidAmount,
      reference,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await intentRef.set({ status: "completed" }, { merge: true });

    logger.info("Plan actualizado tras pago aprobado con Bold", {
      uid: intent.uid,
      plan: intent.plan,
      reference,
    });

    res.status(200).send("ok");
  }
);

/**
 * Corre una vez al día: si un plan pago venció y el usuario no renovó,
 * lo regresa automáticamente al plan gratuito (Emprendedor).
 * Sustituye a un cobro recurrente automático mientras no se integre
 * la tokenización de métodos de pago (fase futura).
 */
export const downgradeExpiredPlans = onSchedule(
  { schedule: "every 24 hours", region: "us-central1" },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const expired = await db
      .collection("users")
      .where("plan", "in", ["pro", "premium"])
      .where("planExpiresAt", "<=", now)
      .get();

    if (expired.empty) {
      logger.info("Sin planes vencidos hoy");
      return;
    }

    const batch = db.batch();
    expired.docs.forEach((doc) => {
      batch.update(doc.ref, { plan: "emprendedor" });
    });
    await batch.commit();

    logger.info(`Planes degradados a emprendedor por vencimiento: ${expired.size}`);
  }
);
