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

// Llaves de Wompi guardadas como secretos de Firebase — nunca en el código ni el cliente.
// Se configuran una sola vez con:
//   firebase functions:secrets:set WOMPI_PUBLIC_KEY
//   firebase functions:secrets:set WOMPI_INTEGRITY_SECRET
//   firebase functions:secrets:set WOMPI_EVENTS_SECRET
const wompiPublicKey = defineSecret("WOMPI_PUBLIC_KEY");
const wompiIntegritySecret = defineSecret("WOMPI_INTEGRITY_SECRET");
const wompiEventsSecret = defineSecret("WOMPI_EVENTS_SECRET");

type PayablePlan = "pro" | "premium";

// Precios en pesos colombianos. Wompi cobra en "centavos" (pesos * 100).
const PLAN_PRICES_COP: Record<PayablePlan, number> = {
  pro: 39900,
  premium: 69900,
};

const PLAN_DURATION_DAYS = 30;

/**
 * Genera la URL de checkout de Wompi para actualizar de plan.
 * El cliente (web o móvil) llama esta función y redirige al usuario a la URL devuelta.
 */
export const createUpgradeCheckout = onCall(
  { secrets: [wompiPublicKey, wompiIntegritySecret], region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para actualizar tu plan.");
    }

    const uid = request.auth.uid;
    const plan = request.data?.plan as PayablePlan;
    const redirectUrl = (request.data?.redirectUrl ?? "").toString();

    if (plan !== "pro" && plan !== "premium") {
      throw new HttpsError("invalid-argument", "Plan inválido. Usa 'pro' o 'premium'.");
    }
    if (!redirectUrl) {
      throw new HttpsError("invalid-argument", "Falta la URL de redirección.");
    }

    const amountInCents = PLAN_PRICES_COP[plan] * 100;
    const currency = "COP";
    // La referencia codifica quién paga y qué plan compra, para que el webhook
    // sepa a quién actualizar sin depender de una consulta adicional.
    const reference = `pinak_${uid}_${plan}_${Date.now()}`;

    // Firma de integridad exigida por Wompi para evitar que alguien manipule
    // el monto o la referencia antes de llegar a su checkout.
    const signature = crypto
      .createHash("sha256")
      .update(`${reference}${amountInCents}${currency}${wompiIntegritySecret.value()}`)
      .digest("hex");

    const params = new URLSearchParams({
      "public-key": wompiPublicKey.value(),
      currency,
      "amount-in-cents": String(amountInCents),
      reference,
      "signature:integrity": signature,
      "redirect-url": redirectUrl,
    });

    const checkoutUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

    logger.info("Checkout de upgrade generado", { uid, plan, reference });

    return { checkoutUrl, reference };
  }
);

/**
 * Endpoint público que recibe las notificaciones de Wompi cuando una
 * transacción cambia de estado. Verifica la firma del evento y, si el pago
 * fue aprobado, actualiza el plan del usuario usando permisos de administrador
 * (el cliente nunca puede cambiar su propio plan directamente — ver firestore.rules).
 */
export const wompiWebhook = onRequest(
  { secrets: [wompiEventsSecret], region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const body = req.body as {
      event?: string;
      data?: { transaction?: Record<string, unknown> };
      timestamp?: number;
      signature?: { checksum?: string; properties?: string[] };
    };

    if (body.event !== "transaction.updated" || !body.data?.transaction) {
      res.status(200).send("ignored");
      return;
    }

    const { checksum, properties } = body.signature ?? {};
    if (!checksum || !properties) {
      logger.warn("Webhook de Wompi sin firma, ignorado");
      res.status(400).send("missing signature");
      return;
    }

    // Reconstruye el string a firmar concatenando los valores de las
    // propiedades indicadas por Wompi, en el orden que ellos especifican.
    const values = properties.map((path) => {
      const parts = path.split(".");
      let value: unknown = { data: body.data };
      for (const part of parts) {
        value = (value as Record<string, unknown> | undefined)?.[part];
      }
      return String(value ?? "");
    });
    const expectedChecksum = crypto
      .createHash("sha256")
      .update(`${values.join("")}${body.timestamp}${wompiEventsSecret.value()}`)
      .digest("hex");

    if (expectedChecksum !== checksum) {
      logger.error("Firma de webhook de Wompi inválida — posible solicitud falsa");
      res.status(401).send("invalid signature");
      return;
    }

    const transaction = body.data.transaction;
    const status = transaction.status as string;
    const reference = transaction.reference as string;

    if (status !== "APPROVED") {
      res.status(200).send("not approved, ignored");
      return;
    }

    // reference tiene el formato: pinak_{uid}_{plan}_{timestamp}
    const match = reference?.match(/^pinak_(.+)_(pro|premium)_\d+$/);
    if (!match) {
      logger.error("Referencia de transacción con formato inesperado", { reference });
      res.status(200).send("unrecognized reference");
      return;
    }
    const [, uid, plan] = match;

    const planExpiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    await db.doc(`users/${uid}`).set(
      { plan, planExpiresAt, planUpdatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    await db.doc(`users/${uid}/payments/${transaction.id}`).set({
      plan,
      amountInCents: transaction.amount_in_cents ?? null,
      status,
      reference,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("Plan actualizado tras pago aprobado", { uid, plan, reference });
    res.status(200).send("ok");
  }
);

/**
 * Corre una vez al día: si un plan pago venció y el usuario no renovó,
 * lo regresa automáticamente al plan gratuito (Emprendedor).
 * Sustituye a un cobro recurrente automático mientras no se integre
 * la tokenización de métodos de pago de Wompi (fase futura).
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
