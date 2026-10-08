import { onCall, HttpsError, type CallableRequest, type FunctionsErrorCode } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  acceptDecision,
  createBusinessDecision,
  inviteDecision,
  normalizeEmail,
  normalizePlan,
  planTrim,
  removeDecision,
  type OwnedBusinessInfo,
  type Plan,
  type Refusal,
} from "./plans";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const REGION = "us-central1";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function refuse(r: Refusal): never {
  throw new HttpsError(r.code as FunctionsErrorCode, r.message);
}

function requireAuth(request: CallableRequest) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para usar esta función.");
  }
  const token = request.auth.token;
  return {
    uid: request.auth.uid,
    email: normalizeEmail(token.email),
    emailVerified: token.email_verified === true,
  };
}

function str(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export function tsMs(v: unknown): number {
  return v && typeof (v as admin.firestore.Timestamp).toMillis === "function"
    ? (v as admin.firestore.Timestamp).toMillis()
    : 0;
}

type Op = (batch: admin.firestore.WriteBatch) => void;

/** Firestore permite 500 operaciones por lote; se usan 400 por margen. */
async function commitOps(ops: Op[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

const DEFAULT_CATEGORIES = [
  { name: "Ventas", type: "ingreso", icon: "💰" },
  { name: "Servicios", type: "ingreso", icon: "🧾" },
  { name: "Otros ingresos", type: "ingreso", icon: "➕" },
  { name: "Insumos", type: "egreso", icon: "📦" },
  { name: "Arriendo", type: "egreso", icon: "🏠" },
  { name: "Nómina", type: "egreso", icon: "👥" },
  { name: "Servicios públicos", type: "egreso", icon: "💡" },
  { name: "Transporte", type: "egreso", icon: "🚚" },
  { name: "Otros gastos", type: "egreso", icon: "➖" },
];

// ---------------------------------------------------------------------------
// Preparar un negocio: migrar datos antiguos o sembrar categorías
// (idempotente: se puede repetir sin duplicar nada)
// ---------------------------------------------------------------------------
async function populateBusiness(businessId: string, legacyUid: string | null) {
  const base = `businesses/${businessId}`;

  if (legacyUid) {
    // Cuentas anteriores a los equipos guardaban todo bajo users/{uid}/...
    for (const name of ["transactions", "receivables", "categories"]) {
      const snap = await db.collection(`users/${legacyUid}/${name}`).get();
      await commitOps(
        snap.docs.map((d) => (b) => b.set(db.doc(`${base}/${name}/${d.id}`), d.data()))
      );
    }
  }

  const anyCategory = await db.collection(`${base}/categories`).limit(1).get();
  if (anyCategory.empty) {
    await commitOps(
      DEFAULT_CATEGORIES.map((cat, i) => (b) =>
        b.set(db.doc(`${base}/categories/default-${i}`), {
          ...cat,
          isDefault: true,
          createdAt: Timestamp.now(),
        })
      )
    );
  }

  await db.doc(base).update({ setupDone: true });
}

// ---------------------------------------------------------------------------
// ensureBusiness: toda cuenta tiene un primer negocio (con id = uid)
// ---------------------------------------------------------------------------
async function ensureBusinessCore(uid: string, email: string, hintName: string) {
  const bizRef = db.doc(`businesses/${uid}`);
  const userRef = db.doc(`users/${uid}`);

  const created = await db.runTransaction(async (tx) => {
    const [bizSnap, userSnap] = await Promise.all([tx.get(bizRef), tx.get(userRef)]);
    if (bizSnap.exists) return false;

    const u = userSnap.data() ?? {};
    const name = str(u.businessName || hintName || "Mi negocio", 80) || "Mi negocio";
    const now = Timestamp.now();
    tx.create(bizRef, {
      name,
      businessType: str(u.businessType, 80),
      phone: str(u.phone, 40),
      city: str(u.city, 80),
      nit: str(u.nit, 40),
      description: str(u.description, 500),
      ownerId: uid,
      memberIds: [uid],
      members: { [uid]: { role: "owner", email, joinedAt: now } },
      plan: normalizePlan(u.plan),
      locked: false,
      setupDone: false,
      createdAt: now,
    });
    return true;
  });

  const current = created ? null : await bizRef.get();
  if (created || current?.get("setupDone") === false) {
    await populateBusiness(uid, uid);
  }
  return { businessId: uid, created };
}

// ---------------------------------------------------------------------------
// Crear un negocio adicional (solo Premium)
// ---------------------------------------------------------------------------
async function createBusinessCore(
  uid: string,
  email: string,
  input: { name: string; businessType: string; phone: string; city: string }
) {
  const userSnap = await db.doc(`users/${uid}`).get();
  const plan = normalizePlan(userSnap.get("plan"));
  const owned = await db.collection("businesses").where("ownerId", "==", uid).get();

  const refusal = createBusinessDecision({ plan, ownedCount: owned.size, name: input.name });
  if (refusal) refuse(refusal);

  const ref = db.collection("businesses").doc();
  const now = Timestamp.now();
  await ref.create({
    name: input.name.trim(),
    businessType: input.businessType,
    phone: input.phone,
    city: input.city,
    nit: "",
    description: "",
    ownerId: uid,
    memberIds: [uid],
    members: { [uid]: { role: "owner", email, joinedAt: now } },
    plan,
    locked: false,
    setupDone: false,
    createdAt: now,
  });
  await populateBusiness(ref.id, null);
  return ref.id;
}

// ---------------------------------------------------------------------------
// Invitaciones y miembros
// ---------------------------------------------------------------------------
type MemberMap = Record<string, { email?: string; role?: string }>;

async function inviteMemberCore(uid: string, businessId: string, emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  const bizRef = db.doc(`businesses/${businessId}`);

  return db.runTransaction(async (tx) => {
    const bizSnap = await tx.get(bizRef);
    if (!bizSnap.exists) throw new HttpsError("not-found", "No se encontró el negocio.");
    const biz = bizSnap.data()!;
    if (biz.ownerId !== uid) {
      throw new HttpsError("permission-denied", "Solo el dueño puede invitar personas.");
    }
    if (biz.locked === true) {
      throw new HttpsError(
        "failed-precondition",
        "Este negocio está bloqueado porque tu plan venció. Renuévalo para invitar personas."
      );
    }

    const pending = await tx.get(
      db
        .collection("invitations")
        .where("businessId", "==", businessId)
        .where("status", "==", "pendiente")
    );

    const members = (biz.members ?? {}) as MemberMap;
    const ownerEmail = String(members[uid]?.email ?? "");

    const refusal = inviteDecision({
      plan: normalizePlan(biz.plan),
      email,
      ownerEmail,
      memberEmails: Object.values(members).map((m) => normalizeEmail(m.email)),
      memberCount: ((biz.memberIds ?? []) as string[]).length,
      pendingEmails: pending.docs.map((d) => normalizeEmail(d.get("email"))),
    });
    if (refusal) refuse(refusal);

    const inviteRef = db.collection("invitations").doc();
    tx.create(inviteRef, {
      businessId,
      businessName: biz.name,
      email,
      invitedByUid: uid,
      invitedByEmail: ownerEmail,
      status: "pendiente",
      createdAt: Timestamp.now(),
    });
    return inviteRef.id;
  });
}

async function acceptInviteCore(
  uid: string,
  tokenEmail: string,
  emailVerified: boolean,
  inviteId: string
) {
  const inviteRef = db.doc(`invitations/${inviteId}`);

  return db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) throw new HttpsError("not-found", "No se encontró la invitación.");
    const inv = inviteSnap.data()!;

    const bizRef = db.doc(`businesses/${inv.businessId}`);
    const bizSnap = await tx.get(bizRef);
    if (!bizSnap.exists) throw new HttpsError("not-found", "El negocio ya no existe.");
    const biz = bizSnap.data()!;
    const memberIds = (biz.memberIds ?? []) as string[];

    const refusal = acceptDecision({
      inviteStatus: String(inv.status),
      inviteEmail: String(inv.email),
      tokenEmail,
      emailVerified,
      alreadyMember: memberIds.includes(uid),
      businessLocked: biz.locked === true,
      plan: normalizePlan(biz.plan),
      memberCount: memberIds.length,
    });
    if (refusal) refuse(refusal);

    const now = Timestamp.now();
    tx.update(bizRef, {
      memberIds: FieldValue.arrayUnion(uid),
      [`members.${uid}`]: { role: "member", email: tokenEmail, joinedAt: now },
    });
    tx.update(inviteRef, { status: "aceptada", acceptedByUid: uid, acceptedAt: now });
    return String(inv.businessId);
  });
}

async function declineInviteCore(
  tokenEmail: string,
  emailVerified: boolean,
  inviteId: string
) {
  const inviteRef = db.doc(`invitations/${inviteId}`);
  const snap = await inviteRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "No se encontró la invitación.");
  if (!emailVerified || normalizeEmail(snap.get("email")) !== tokenEmail) {
    throw new HttpsError("permission-denied", "Esta invitación no es para tu cuenta.");
  }
  if (snap.get("status") !== "pendiente") return;
  await inviteRef.update({ status: "rechazada" });
}

async function cancelInviteCore(uid: string, inviteId: string) {
  const inviteRef = db.doc(`invitations/${inviteId}`);
  const snap = await inviteRef.get();
  if (!snap.exists) return;
  if (snap.get("invitedByUid") !== uid) {
    throw new HttpsError("permission-denied", "Solo quien envió la invitación puede cancelarla.");
  }
  await inviteRef.delete();
}

async function removeMemberCore(uid: string, businessId: string, targetUid: string) {
  const bizRef = db.doc(`businesses/${businessId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bizRef);
    if (!snap.exists) throw new HttpsError("not-found", "No se encontró el negocio.");
    const biz = snap.data()!;
    const refusal = removeDecision({
      actorUid: uid,
      ownerId: String(biz.ownerId),
      targetUid,
      targetIsMember: ((biz.memberIds ?? []) as string[]).includes(targetUid),
    });
    if (refusal) refuse(refusal);
    tx.update(bizRef, {
      memberIds: FieldValue.arrayRemove(targetUid),
      [`members.${targetUid}`]: FieldValue.delete(),
    });
  });
}

// ---------------------------------------------------------------------------
// Sincroniza el plan del dueño hacia todos sus negocios.
// Al bajar de plan, bloquea los negocios que ya no caben y quita a las personas
// que exceden el límite de usuarios (las más recientes primero).
// ---------------------------------------------------------------------------
export async function syncBusinessPlans(
  ownerUid: string,
  plan: Plan,
  opts: { cancelPendingInvites?: boolean } = {}
) {
  const snap = await db.collection("businesses").where("ownerId", "==", ownerUid).get();
  if (snap.empty) return;

  const info: OwnedBusinessInfo[] = snap.docs.map((d) => ({
    id: d.id,
    createdAtMs: tsMs(d.get("createdAt")),
    members: Object.entries((d.get("members") ?? {}) as Record<string, { joinedAt?: unknown }>)
      .filter(([memberUid]) => memberUid !== ownerUid)
      .map(([memberUid, m]) => ({ uid: memberUid, joinedAtMs: tsMs(m.joinedAt) })),
  }));

  const trim = planTrim(info, plan);
  const ops: Op[] = [];

  for (const d of snap.docs) {
    ops.push((b) => b.update(d.ref, { plan, locked: trim.lock.includes(d.id) }));
  }
  for (const r of trim.removeMembers) {
    const ref = db.doc(`businesses/${r.businessId}`);
    const update: Record<string, unknown> = {
      memberIds: FieldValue.arrayRemove(...r.uids),
    };
    for (const u of r.uids) update[`members.${u}`] = FieldValue.delete();
    ops.push((b) => b.update(ref, update));
  }
  if (opts.cancelPendingInvites) {
    for (const d of snap.docs) {
      const pending = await db
        .collection("invitations")
        .where("businessId", "==", d.id)
        .where("status", "==", "pendiente")
        .get();
      pending.docs.forEach((p) => ops.push((b) => b.delete(p.ref)));
    }
  }

  await commitOps(ops);
  logger.info("Planes de negocios sincronizados", {
    ownerUid,
    plan,
    locked: trim.lock.length,
    removed: trim.removeMembers.reduce((n, r) => n + r.uids.length, 0),
  });
}

// ---------------------------------------------------------------------------
// Funciones expuestas a la app
// ---------------------------------------------------------------------------
export const ensureBusiness = onCall({ region: REGION }, async (request) => {
  const { uid, email } = requireAuth(request);
  return ensureBusinessCore(uid, email, str(request.data?.businessName, 80));
});

export const createBusiness = onCall({ region: REGION }, async (request) => {
  const { uid, email } = requireAuth(request);
  const d = request.data ?? {};
  const businessId = await createBusinessCore(uid, email, {
    name: str(d.name, 80),
    businessType: str(d.businessType, 80),
    phone: str(d.phone, 40),
    city: str(d.city, 80),
  });
  return { businessId };
});

export const inviteMember = onCall({ region: REGION }, async (request) => {
  const { uid } = requireAuth(request);
  const businessId = str(request.data?.businessId, 128);
  if (!businessId) throw new HttpsError("invalid-argument", "Falta el negocio.");
  const inviteId = await inviteMemberCore(uid, businessId, request.data?.email);
  return { inviteId };
});

export const acceptInvite = onCall({ region: REGION }, async (request) => {
  const { uid, email, emailVerified } = requireAuth(request);
  const inviteId = str(request.data?.inviteId, 128);
  if (!inviteId) throw new HttpsError("invalid-argument", "Falta la invitación.");
  const businessId = await acceptInviteCore(uid, email, emailVerified, inviteId);
  return { businessId };
});

export const declineInvite = onCall({ region: REGION }, async (request) => {
  const { email, emailVerified } = requireAuth(request);
  const inviteId = str(request.data?.inviteId, 128);
  if (!inviteId) throw new HttpsError("invalid-argument", "Falta la invitación.");
  await declineInviteCore(email, emailVerified, inviteId);
  return { ok: true };
});

export const cancelInvite = onCall({ region: REGION }, async (request) => {
  const { uid } = requireAuth(request);
  const inviteId = str(request.data?.inviteId, 128);
  if (!inviteId) throw new HttpsError("invalid-argument", "Falta la invitación.");
  await cancelInviteCore(uid, inviteId);
  return { ok: true };
});

export const removeMember = onCall({ region: REGION }, async (request) => {
  const { uid } = requireAuth(request);
  const businessId = str(request.data?.businessId, 128);
  const memberUid = str(request.data?.memberUid, 128);
  if (!businessId || !memberUid) throw new HttpsError("invalid-argument", "Faltan datos.");
  await removeMemberCore(uid, businessId, memberUid);
  return { ok: true };
});
