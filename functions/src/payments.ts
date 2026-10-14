import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { syncBusinessPlans } from "./businesses";
import { expiryDecision, paymentDecision, PAID_PLAN_DAYS, type Plan, type PendingPlan } from "./plans";
import * as crypto from "crypto";
import { ENFORCE_APP_CHECK } from "./options";

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

// Solo se aceptan redirecciones a los dominios propios de PINAK, a la pantalla de confirmación.
const ALLOWED_REDIRECT_HOSTS = ["pinak-nine.vercel.app", "pinak-dev.web.app", "pinak-dev.firebaseapp.com"];
const REDIRECT_PATH_PREFIX = "/upgrade/procesando/";
function isAllowedRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      ALLOWED_REDIRECT_HOSTS.includes(u.hostname) &&
      u.pathname.startsWith(REDIRECT_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}

function toState(data: FirebaseFirestore.DocumentData | undefined) {
  const plan: Plan = data?.plan === "pro" || data?.plan === "premium" ? data.plan : "emprendedor";
  const pp = data?.pendingPlan as { plan?: string; startAt?: admin.firestore.Timestamp; days?: number } | undefined;
  const pending: PendingPlan | null =
    pp && (pp.plan === "pro" || pp.plan === "premium") && pp.startAt
      ? { plan: pp.plan, startMs: pp.startAt.toMillis(), days: Number(pp.days) || PAID_PLAN_DAYS }
      : null;
  return {
    plan,
    trial: data?.planTrial === true,
    expiresMs: (data?.planExpiresAt?.toMillis?.() as number | undefined) ?? null,
    pending,
  };
}

function pendingToDoc(p: PendingPlan | null) {
  return p
    ? { plan: p.plan, startAt: admin.firestore.Timestamp.fromMillis(p.startMs), days: p.days }
    : admin.firestore.FieldValue.delete();
}

/**
 * Genera los datos firmados que el cliente necesita para abrir el checkout
 * de Bold (usando su constructor `BoldCheckout` en el navegador/WebView).
 * Guarda también la "intención de compra" en Firestore para que el webhook
 * sepa, con solo el orderId, a qué usuario y plan corresponde el pago.
 */
export const createBoldCheckout = onCall({ enforceAppCheck: ENFORCE_APP_CHECK, secrets: [boldIdentityKey, boldSecretKey], region: "us-central1" },
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
    if (!isAllowedRedirect(redirectionUrl)) {
      throw new HttpsError("invalid-argument", "La URL de redirección no está permitida.");
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
      .update(`${orderId}${amount}${currency}${boldSecretKey.value().trim()}`)
      .digest("hex");

    logger.info("Checkout de Bold generado", { uid, plan, orderId });

    return {
      identityKey: boldIdentityKey.value().trim(),
      orderId,
      amount: String(amount),
      currency,
      integritySignature,
      // El orderId viaja en la URL para que la pantalla de confirmación sepa qué pago esperar.
      redirectionUrl: `${redirectionUrl.split("?")[0]}?order=${encodeURIComponent(orderId)}`,
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
      .createHmac("sha256", boldSecretKey.value().trim())
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

    const paidAmount = body.data?.amount?.total;
    const paidCurrency = body.data?.amount?.currency;
    const STALE_MS = 2 * 60 * 1000;

    // Se reclama la intención dentro de una transacción: pending → processing.
    // Un reintento simultáneo que la encuentre en otro estado no hace nada.
    const claim = await db.runTransaction(async (tx) => {
      const snap = await tx.get(intentRef);
      const intent = snap.data() as {
        uid: string;
        plan: PayablePlan;
        amount: number;
        status: string;
        syncFailed?: boolean;
        processingAt?: admin.firestore.Timestamp;
        appliedPlan?: Plan;
      };

      if (intent.status === "completed") return { kind: "ignore" as const };
      if (intent.status === "processing") {
        // Solo se retoma si la sincronización anterior falló o quedó colgada.
        const stale = Date.now() - (intent.processingAt?.toMillis() ?? 0) > STALE_MS;
        if (intent.syncFailed || stale) {
          tx.set(intentRef, { syncFailed: false, processingAt: admin.firestore.Timestamp.now() }, { merge: true });
          return { kind: "resume" as const, uid: intent.uid, plan: intent.appliedPlan ?? intent.plan };
        }
        return { kind: "ignore" as const };
      }

      if (paidAmount !== intent.amount || paidCurrency !== "COP") {
        return { kind: "mismatch" as const, expected: intent.amount };
      }

      const userRef = db.doc(`users/${intent.uid}`);
      const userSnap = await tx.get(userRef);
      const result = paymentDecision({
        nowMs: Date.now(),
        state: toState(userSnap.data()),
        paid: intent.plan,
      });

      tx.set(
        userRef,
        {
          plan: result.plan,
          planTrial: false,
          planExpiresAt: result.expiresMs === null ? null : admin.firestore.Timestamp.fromMillis(result.expiresMs),
          pendingPlan: pendingToDoc(result.pending),
          planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(db.doc(`users/${intent.uid}/payments/${body.data?.payment_id ?? reference}`), {
        plan: intent.plan,
        amount: paidAmount,
        reference,
        appliedNow: result.appliedNow,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(
        intentRef,
        { status: "processing", processingAt: admin.firestore.Timestamp.now(), appliedPlan: result.plan, syncFailed: false },
        { merge: true }
      );
      return { kind: "applied" as const, uid: intent.uid, plan: result.plan };
    });

    if (claim.kind === "ignore") {
      res.status(200).send("already processed or in progress");
      return;
    }
    if (claim.kind === "mismatch") {
      logger.error("Monto o moneda del pago no coinciden — posible manipulación", {
        reference,
        esperado: claim.expected,
        recibido: paidAmount,
        moneda: paidCurrency,
      });
      res.status(200).send("amount mismatch, not granting plan");
      return;
    }

    // El plan del dueño se refleja en todos sus negocios. Si falla, se responde
    // 500 y el reintento de Bold retoma desde aquí (el plan ya quedó aplicado).
    try {
      await syncBusinessPlans(claim.uid, claim.plan);
    } catch (err) {
      logger.error("No se pudo sincronizar el plan con los negocios", { uid: claim.uid, err });
      await intentRef.set({ syncFailed: true }, { merge: true }).catch(() => undefined);
      res.status(500).send("business sync failed");
      return;
    }

    await intentRef.set({ status: "completed" }, { merge: true });

    logger.info("Plan actualizado tras pago aprobado con Bold", {
      uid: claim.uid,
      plan: claim.plan,
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
    // Una sola condición de rango (no necesita índice compuesto); el plan se filtra aquí.
    const snap = await db
      .collection("users")
      .where("planExpiresAt", "<=", admin.firestore.Timestamp.now())
      .get();
    const expired = snap.docs.filter((d) => d.get("plan") === "pro" || d.get("plan") === "premium");

    if (expired.length === 0) {
      logger.info("Sin planes vencidos hoy");
      return;
    }

    // Usuario por usuario: primero se ajustan los negocios y SOLO si sale bien se
    // actualiza el usuario. Si algo falla, sigue vencido y se reintenta mañana.
    let done = 0;
    for (const doc of expired) {
      try {
        const next = expiryDecision({ nowMs: Date.now(), pending: toState(doc.data()).pending });
        await syncBusinessPlans(doc.id, next.plan, { cancelPendingInvites: next.plan === "emprendedor" });
        await doc.ref.update({
          plan: next.plan,
          planTrial: false,
          planExpiresAt: next.expiresMs === null ? null : admin.firestore.Timestamp.fromMillis(next.expiresMs),
          pendingPlan: admin.firestore.FieldValue.delete(),
          planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        done++;
      } catch (err) {
        logger.error("No se pudo degradar al usuario vencido", { uid: doc.id, err });
      }
    }

    logger.info(`Planes procesados por vencimiento: ${done}/${expired.length}`);
  }
);

/**
 * Estado de un pago para la pantalla "Confirmando tu pago". Solo responde al
 * dueño de la intención; las reglas siguen negando la lectura directa.
 */
export const getCheckoutStatus = onCall({ enforceAppCheck: ENFORCE_APP_CHECK, region: "us-central1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const orderId = String(request.data?.orderId ?? "").trim();
  if (!/^pinak-[a-z0-9-]+$/.test(orderId)) throw new HttpsError("invalid-argument", "Pago no válido.");
  const snap = await db.collection("checkoutIntents").doc(orderId).get();
  if (!snap.exists || snap.get("uid") !== request.auth.uid) {
    throw new HttpsError("not-found", "No encontramos ese pago.");
  }
  return { status: String(snap.get("status") ?? "pending") };
});
