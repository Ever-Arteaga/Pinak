import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { syncBusinessPlans } from "./businesses";
import { ENFORCE_APP_CHECK } from "./options";
import { isAdminEmail, parseAdminEmails } from "./adminStats";
import type { Plan } from "./plans";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const PLANS: Plan[] = ["emprendedor", "essential", "pro", "premium"];
const GIFT_YEARS = 10;

/**
 * Cuentas de pruebas: los correos de FREE_PLAN_EMAILS (functions/.env) pueden cambiar de plan
 * libremente, sin pagar. Sin `plan` solo responde si la cuenta tiene este permiso.
 * El correo debe estar verificado; a cualquier otra persona no se le revela nada.
 */
export const freePlanAccess = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, region: "us-central1" },
  async (request): Promise<{ enabled: boolean; plan?: Plan }> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");
    const allowed = parseAdminEmails(process.env.FREE_PLAN_EMAILS);
    const email = request.auth?.token.email_verified === true ? request.auth.token.email : undefined;
    if (!isAdminEmail(email, allowed)) return { enabled: false };

    const plan = request.data?.plan as Plan | undefined;
    if (plan === undefined) return { enabled: true };
    if (!PLANS.includes(plan)) throw new HttpsError("invalid-argument", "Plan no válido.");

    const free = plan === "emprendedor";
    await db.doc(`users/${uid}`).set(
      {
        plan,
        planTrial: false,
        planGift: !free,
        planExpiresAt: free
          ? null
          : admin.firestore.Timestamp.fromMillis(Date.now() + GIFT_YEARS * 365 * 24 * 60 * 60 * 1000),
        pendingPlan: admin.firestore.FieldValue.delete(),
        planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    try {
      await syncBusinessPlans(uid, plan);
    } catch (err) {
      logger.error("No se pudo sincronizar el plan de pruebas con los negocios", { uid, err });
      throw new HttpsError("internal", "No se pudo cambiar el plan. Intenta de nuevo.");
    }
    logger.info("Plan de pruebas cambiado", { uid, plan });
    return { enabled: true, plan };
  }
);
