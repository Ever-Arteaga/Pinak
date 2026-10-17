import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { ENFORCE_APP_CHECK } from "./options";
import { isDeleteConfirmed, isRecentLogin } from "./accountRules";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * Borra TODO lo de una persona: sus negocios (con movimientos, fiados, categorías y
 * resúmenes), su pertenencia a negocios ajenos, sus invitaciones, su perfil, su historial
 * de pagos en la app y por último su usuario de acceso. Es idempotente: si algo falla a
 * medias, repetirlo termina el trabajo (el usuario de acceso se borra al final).
 */
async function deleteAccountData(uid: string, email: string) {
  // 1. Negocios propios. Se marcan antes como "deleting" para que el trigger de resúmenes
  //    no vuelva a crear documentos mientras se borran los movimientos.
  const owned = await db.collection("businesses").where("ownerId", "==", uid).get();
  for (const b of owned.docs) await b.ref.update({ deleting: true });
  for (const b of owned.docs) {
    const invites = await db.collection("invitations").where("businessId", "==", b.id).get();
    await Promise.all(invites.docs.map((i) => i.ref.delete()));
    await db.recursiveDelete(b.ref);
  }

  // 2. Negocios de otras personas donde era miembro: solo se le quita.
  const memberOf = await db.collection("businesses").where("memberIds", "array-contains", uid).get();
  for (const b of memberOf.docs) {
    if (b.get("ownerId") === uid) continue;
    await b.ref.update({
      memberIds: FieldValue.arrayRemove(uid),
      [`members.${uid}`]: FieldValue.delete(),
    });
  }

  // 3. Invitaciones que envió o que le llegaron.
  const sent = await db.collection("invitations").where("invitedByUid", "==", uid).get();
  await Promise.all(sent.docs.map((i) => i.ref.delete()));
  if (email) {
    const received = await db.collection("invitations").where("email", "==", email).get();
    await Promise.all(received.docs.map((i) => i.ref.delete()));
  }

  // 4. Intentos de pago y perfil (incluye su subcolección de pagos).
  const intents = await db.collection("checkoutIntents").where("uid", "==", uid).get();
  await Promise.all(intents.docs.map((i) => i.ref.delete()));
  await db.recursiveDelete(db.doc(`users/${uid}`));

  // 5. Al final, el usuario de acceso.
  try {
    await admin.auth().deleteUser(uid);
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }
}

export const deleteAccount = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, region: "us-central1", timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para eliminar tu cuenta.");
    }
    if (!isDeleteConfirmed(request.data?.confirmation)) {
      throw new HttpsError("invalid-argument", "Escribe ELIMINAR para confirmar.");
    }
    if (!isRecentLogin(request.auth.token.auth_time, Date.now())) {
      throw new HttpsError(
        "failed-precondition",
        "Por seguridad, confirma tu identidad iniciando sesión de nuevo y vuelve a intentarlo."
      );
    }

    const uid = request.auth.uid;
    const email = String(request.auth.token.email ?? "").trim().toLowerCase();
    try {
      await deleteAccountData(uid, email);
    } catch (err) {
      logger.error("No se pudo eliminar la cuenta", { uid, err });
      throw new HttpsError("internal", "No se pudo eliminar la cuenta. Intenta de nuevo en unos minutos.");
    }
    logger.info("Cuenta eliminada", { uid });
    return { ok: true };
  }
);
