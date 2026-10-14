import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, addDoc, updateDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "pinak-dev",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
afterAll(async () => env?.cleanup());

// Negocio "b1" de ana (miembro), "b2" bloqueado; luis no es miembro de ninguno.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "businesses/b1"), { name: "Tienda", ownerId: "ana", memberIds: ["ana"], plan: "pro", locked: false });
    await setDoc(doc(db, "businesses/b2"), { name: "Bloqueado", ownerId: "ana", memberIds: ["ana"], plan: "emprendedor", locked: true });
    await setDoc(doc(db, "users/ana"), {
      email: "ana@x.co", businessName: "Tienda", plan: "pro", createdAt: Timestamp.now(),
      planExpiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    });
    await setDoc(doc(db, "businesses/b1/transactions/t1"), {
      type: "ingreso", amount: 1000, category: "Ventas", method: "efectivo", date: Timestamp.now(),
      source: "manual", createdAt: Timestamp.now(), createdBy: "ana",
    });
  });
});

const ana = () => env.authenticatedContext("ana").firestore();
const luis = () => env.authenticatedContext("luis").firestore();

const tx = (extra = {}) => ({
  type: "egreso", amount: 500, category: "Insumos", method: "nequi", description: "x",
  date: Timestamp.now(), source: "manual", createdAt: serverTimestamp(), createdBy: "ana", ...extra,
});

describe("acceso al negocio", () => {
  it("un miembro lee y escribe en su negocio", async () => {
    await assertSucceeds(getDoc(doc(ana(), "businesses/b1/transactions/t1")));
    await assertSucceeds(addDoc(collection(ana(), "businesses/b1/transactions"), tx()));
  });
  it("un no miembro no puede leer ni escribir", async () => {
    await assertFails(getDoc(doc(luis(), "businesses/b1/transactions/t1")));
    await assertFails(addDoc(collection(luis(), "businesses/b1/transactions"), tx({ createdBy: "luis" })));
  });
  it("un negocio bloqueado no permite escribir", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/b2/transactions"), tx()));
  });
});

describe("resúmenes", () => {
  it("un miembro los lee pero nadie los escribe desde el cliente", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "businesses/b1/summaries/all"), { income: 1, expense: 0, count: 1 });
    });
    await assertSucceeds(getDoc(doc(ana(), "businesses/b1/summaries/all")));
    await assertFails(getDoc(doc(luis(), "businesses/b1/summaries/all")));
    await assertFails(setDoc(doc(ana(), "businesses/b1/summaries/all"), { income: 999999 }));
  });
});

describe("plan y vencimiento", () => {
  it("nadie cambia su plan ni su vencimiento desde el cliente", async () => {
    await assertFails(updateDoc(doc(ana(), "users/ana"), { plan: "premium" }));
    await assertFails(updateDoc(doc(ana(), "users/ana"), { planExpiresAt: Timestamp.fromMillis(Date.now() + 9e10) }));
    await assertFails(updateDoc(doc(ana(), "users/ana"), { pendingPlan: { plan: "pro" } }));
  });
  it("sí puede cambiar su perfil", async () => {
    await assertSucceeds(updateDoc(doc(ana(), "users/ana"), { city: "Cartagena" }));
  });
});

describe("validación de transacciones", () => {
  it("rechaza campos extra", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/b1/transactions"), tx({ extra: "hola" })));
  });
  it("rechaza fecha en texto", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/b1/transactions"), tx({ date: "2026-10-14" })));
  });
  it("rechaza createdBy de otra persona", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/b1/transactions"), tx({ createdBy: "luis" })));
  });
  it("rechaza createdAt falso", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/b1/transactions"), tx({ createdAt: Timestamp.fromMillis(1) })));
  });
  it("rechaza origen inválido", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/b1/transactions"), tx({ source: "hack" })));
  });
  it("no deja cambiar createdBy, createdAt ni source al editar", async () => {
    const ref = doc(ana(), "businesses/b1/transactions/t1");
    await assertFails(updateDoc(ref, { createdBy: "luis" }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { source: "ia_voz" }));
    await assertSucceeds(updateDoc(ref, { amount: 2000 }));
  });
});
