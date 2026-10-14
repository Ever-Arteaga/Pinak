import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { syncBusinessPlans } from "./businesses";
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
const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_RANK: Record<"emprendedor" | PayablePlan, number> = { emprendedor: 0, pro: 1, premium: 2 };

// Solo se aceptan redirecciones a los dominios propios de PINAK.
const ALLOWED_REDIRECT_HOSTS = ["pinak-nine.vercel.app", "pinak-dev.web.app", "pinak-dev.firebaseapp.com"];
function isAllowedRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_REDIRECT_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Plan de pago vigente (no vencido) del usuario, o null si está en gratis o ya venció. */
function activePaidPlan(
  data: FirebaseFirestore.DocumentData | undefined
): { plan: PayablePlan; trial: boolean; expiresMs: number } | null {
  const plan = data?.plan;
  if (plan !== "pro" && plan !== "premium") return null;
  const expiresMs: number = data?.planExpiresAt?.toMillis?.() ?? 0;
  if (expiresMs <= Date.now()) return null;
  return { plan, trial: data?.planTrial === true, expiresMs };
}

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
    if (!isAllowedRedirect(redirectionUrl)) {
      throw new HttpsError("invalid-argument", "La URL de redirección no está permitida.");
    }

    const userSnap = await db.doc(`users/${uid}`).get();
    const active = activePaidPlan(userSnap.data());
    if (active && !active.trial && PLAN_RANK[active.plan] > PLAN_RANK[plan]) {
      throw new HttpsError(
        "failed-precondition",
        "Ya tienes un plan superior activo. Podrás cambiar al terminar tu periodo."
      );
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

    // Todo el cambio de plan ocurre en una transacción: un reintento de Bold
    // (o dos notificaciones simultáneas) nunca aplica el mismo pago dos veces.
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(intentRef);
      const intent = snap.data() as { uid: string; plan: PayablePlan; amount: number; status: string };
      if (intent.status === "completed") return { kind: "done" as const };
      if (intent.status === "plan_applied") return { kind: "resume" as const, intent };

      if (paidAmount !== intent.amount || (paidCurrency && paidCurrency !== "COP")) {
        return { kind: "mismatch" as const, intent };
      }

      const userRef = db.doc(`users/${intent.uid}`);
      const userSnap = await tx.get(userRef);
      const active = activePaidPlan(userSnap.data());
      const now = Date.now();

      let plan: PayablePlan = intent.plan;
      let baseMs = now;
      if (active && !active.trial) {
        if (PLAN_RANK[active.plan] > PLAN_RANK[intent.plan]) {
          // Pagó un plan menor al que ya tiene: conserva el mayor, sin quitarle nada.
          plan = active.plan;
          baseMs = active.expiresMs;
        } else if (active.plan === intent.plan) {
          // Renovación anticipada: suma 30 días al vencimiento actual.
          baseMs = active.expiresMs;
        }
      }
      const planExpiresAt = admin.firestore.Timestamp.fromMillis(baseMs + PLAN_DURATION_DAYS * DAY_MS);

      tx.set(
        userRef,
        { plan, planTrial: false, planExpiresAt, planUpdatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      tx.set(
        db.doc(`users/${intent.uid}/payments/${body.data?.payment_id ?? reference}`),
        { plan: intent.plan, amount: paidAmount, reference, createdAt: admin.firestore.FieldValue.serverTimestamp() }
      );
      tx.set(intentRef, { status: "plan_applied", appliedPlan: plan }, { merge: true });
      return { kind: "applied" as const, intent: { ...intent, plan } };
    });

    if (outcome.kind === "done") {
      res.status(200).send("already processed");
      return;
    }
    if (outcome.kind === "mismatch") {
      logger.error("Monto o moneda del pago no coinciden — posible manipulación", {
        reference,
        esperado: outcome.intent.amount,
        recibido: paidAmount,
        moneda: paidCurrency,
      });
      res.status(200).send("amount mismatch, not granting plan");
      return;
    }

    const intent = outcome.intent;
    const syncPlan: PayablePlan =
      outcome.kind === "resume"
        ? (((await intentRef.get()).get("appliedPlan") as PayablePlan | undefined) ?? intent.plan)
        : intent.plan;

    // El plan del dueño se refleja en todos sus negocios. Si falla, se responde
    // 500 y el reintento de Bold retoma desde aquí (el plan ya quedó aplicado).
    try {
      await syncBusinessPlans(intent.uid, syncPlan);
    } catch (err) {
      logger.error("No se pudo sincronizar el plan con los negocios", { uid: intent.uid, err });
      res.status(500).send("business sync failed");
      return;
    }

    await intentRef.set({ status: "completed" }, { merge: true });

    logger.info("Plan actualizado tras pago aprobado con Bold", {
      uid: intent.uid,
      plan: syncPlan,
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
    // Una sola condición de rango (sin índice compuesto); el plan se filtra aquí.
    const snap = await db
      .collection("users")
      .where("planExpiresAt", "<=", admin.firestore.Timestamp.now())
      .get();
    const expired = snap.docs.filter((d) => d.get("plan") === "pro" || d.get("plan") === "premium");

    if (expired.length === 0) {
      logger.info("Sin planes vencidos hoy");
      return;
    }

    // Primero se ajustan los negocios y SOLO si sale bien se baja el plan del usuario:
    // si algo falla, el usuario sigue vencido y se reintenta en la próxima corrida.
    let done = 0;
    for (const doc of expired) {
      try {
        await syncBusinessPlans(doc.id, "emprendedor", { cancelPendingInvites: true });
        await doc.ref.update({ plan: "emprendedor", planTrial: false });
        done++;
      } catch (err) {
        logger.error("No se pudo degradar al usuario vencido", { uid: doc.id, err });
      }
    }

    logger.info(`Planes degradados a emprendedor por vencimiento: ${done}/${expired.length}`);
  }
);
