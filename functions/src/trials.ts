import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { syncBusinessPlans } from "./businesses";
import { normalizePlan, trialDecision, TRIAL_DAYS, type Plan } from "./plans";
import { ENFORCE_APP_CHECK } from "./options";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/** Activa 15 días gratis de Pro o Premium (una vez por plan y por cuenta). */
export const startTrial = onCall({ enforceAppCheck: ENFORCE_APP_CHECK, region: "us-central1" }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  const target = request.data?.plan;

  const ref = db.doc(`users/${uid}`);
  const plan = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "No encontramos tu cuenta.");
    const d = snap.data() ?? {};
    const refusal = trialDecision({
      target,
      currentPlan: normalizePlan(d.plan),
      currentIsTrial: d.planTrial === true,
      trialsUsed: (d.trialsUsed ?? {}) as Partial<Record<Plan, boolean>>,
    });
    if (refusal) throw new HttpsError(refusal.code, refusal.message);

    tx.set(
      ref,
      {
        plan: target,
        planTrial: true,
        planExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        trialsUsed: { [target as string]: true },
      },
      { merge: true }
    );
    return target as Plan;
  });

  try {
    await syncBusinessPlans(uid, plan);
  } catch (err) {
    logger.error("No se pudo sincronizar la prueba con los negocios", { uid, err });
    throw new HttpsError("internal", "No se pudo activar la prueba. Intenta de nuevo.");
  }
  return { plan, days: TRIAL_DAYS };
});
