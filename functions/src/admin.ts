import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { ENFORCE_APP_CHECK } from "./options";
import { deleteAccountData } from "./accounts";
import { classifyUser, isAdminEmail, parseAdminEmails, summarize, type AdminUserRow } from "./adminStats";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MAX_ROWS = 2000;
/** Cuentas huérfanas (ya no existen en Authentication) que se limpian en cada consulta. */
const MAX_PURGE_PER_CALL = 5;

/** UIDs de la lista que ya no existen en Authentication. Si la consulta falla, devuelve vacío (no se oculta ni se borra nada). */
async function missingFromAuth(uids: string[]): Promise<Set<string>> {
  const missing = new Set<string>();
  try {
    for (let i = 0; i < uids.length; i += 100) {
      const res = await admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
      for (const n of res.notFound) if ("uid" in n) missing.add(n.uid);
    }
  } catch {
    return new Set();
  }
  return missing;
}

/**
 * Panel de administración: cuántas personas hay en cada plan.
 * Solo responde a los correos de ADMIN_EMAILS (functions/.env); a cualquier otra
 * persona le devuelve "permission-denied" y no revela nada.
 */
export const adminOverview = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, region: "us-central1", timeoutSeconds: 120 },
  async (request): Promise<{ summary: ReturnType<typeof summarize>; users: AdminUserRow[]; truncated: boolean }> => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión.");
    const admins = parseAdminEmails(process.env.ADMIN_EMAILS);
    const email = request.auth.token.email_verified === true ? request.auth.token.email : undefined;
    if (!isAdminEmail(email, admins)) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta sección.");
    }

    const snap = await admin.firestore().collection("users").limit(MAX_ROWS + 1).get();
    const docs = snap.docs.slice(0, MAX_ROWS);
    // Quien fue eliminado de Authentication ya no se muestra, y sus datos sobrantes se limpian.
    const missing = await missingFromAuth(docs.map((d) => d.id));
    const orphans = docs.filter((d) => missing.has(d.id));
    for (const o of orphans.slice(0, MAX_PURGE_PER_CALL)) {
      try {
        await deleteAccountData(o.id, String(o.get("email") ?? "").trim().toLowerCase());
      } catch (err) {
        console.error("No se pudo limpiar una cuenta huérfana", o.id, err);
      }
    }
    const nowMs = Date.now();
    const rows = docs.filter((d) => !missing.has(d.id)).map((d) => {
      const x = d.data();
      return classifyUser(
        {
          uid: d.id,
          email: typeof x.email === "string" ? x.email : "",
          businessName: typeof x.businessName === "string" ? x.businessName : "",
          plan: typeof x.plan === "string" ? x.plan : "emprendedor",
          planTrial: x.planTrial === true,
          expiresMs: x.planExpiresAt?.toMillis?.() ?? null,
          createdMs: x.createdAt?.toMillis?.() ?? null,
        },
        nowMs
      );
    });
    rows.sort((a, b) => (b.createdMs ?? 0) - (a.createdMs ?? 0));
    return { summary: summarize(rows), users: rows, truncated: snap.size > MAX_ROWS };
  }
);
