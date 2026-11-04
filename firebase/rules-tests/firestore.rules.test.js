import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp, Timestamp, runTransaction } from "firebase/firestore";

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
    await setDoc(doc(db, "businesses/bp"), { name: "Premium", ownerId: "ana", memberIds: ["ana"], plan: "premium", locked: false });
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

describe("clientes, catálogo y recibos", () => {
  const cust = (extra = {}) => ({ name: "María", phone: "3001234567", createdAt: serverTimestamp(), createdBy: "ana", ...extra });
  const prod = (extra = {}) => ({ name: "Almuerzo", price: 15000, kind: "producto", createdAt: serverTimestamp(), createdBy: "ana", ...extra });
  const rec = (n, extra = {}) => ({
    number: n, customerName: "María", items: [{ name: "Almuerzo", qty: 2, price: 15000 }], total: 30000,
    method: "efectivo", status: "pagado", date: Timestamp.now(), createdAt: serverTimestamp(), createdBy: "ana", ...extra,
  });

  it("un miembro crea clientes y productos válidos; un no miembro no", async () => {
    await assertSucceeds(addDoc(collection(ana(), "businesses/bp/customers"), cust()));
    await assertSucceeds(addDoc(collection(ana(), "businesses/bp/products"), prod()));
    await assertFails(addDoc(collection(luis(), "businesses/bp/customers"), cust({ createdBy: "luis" })));
    await assertFails(addDoc(collection(luis(), "businesses/bp/products"), prod({ createdBy: "luis" })));
  });
  it("solo el plan Premium puede crear clientes, catálogo y recibos", async () => {
    // b1 es plan Pro
    await assertFails(addDoc(collection(ana(), "businesses/b1/customers"), cust()));
    await assertFails(addDoc(collection(ana(), "businesses/b1/products"), prod()));
    await assertFails(addDoc(collection(ana(), "businesses/b1/receipts"), rec(1)));
    await assertFails(setDoc(doc(ana(), "businesses/b1/meta/counters"), { receipt: 1 }));
  });
  it("rechaza campos extra y datos inválidos", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/bp/customers"), cust({ extra: 1 })));
    await assertFails(addDoc(collection(ana(), "businesses/bp/products"), prod({ price: -1 })));
    await assertFails(addDoc(collection(ana(), "businesses/bp/products"), prod({ kind: "otro" })));
  });
  it("el recibo se crea con consecutivo, ingreso y sin saltos", async () => {
    const db = ana();
    const counter = doc(db, "businesses/bp/meta/counters");
    await assertSucceeds(runTransaction(db, async (t) => {
      const snap = await t.get(counter);
      const next = (snap.exists() ? snap.data().receipt : 0) + 1;
      t.set(counter, { receipt: next });
      t.set(doc(collection(db, "businesses/bp/receipts")), rec(next));
      t.set(doc(collection(db, "businesses/bp/transactions")), tx({ type: "ingreso", amount: 30000, category: "Ventas" }));
    }));
    await assertSucceeds(runTransaction(db, async (t) => {
      const snap = await t.get(counter);
      const next = snap.data().receipt + 1;
      t.set(counter, { receipt: next });
      t.set(doc(collection(db, "businesses/bp/receipts")), rec(next));
    }));
    // saltar el consecutivo no se permite
    await assertFails(setDoc(counter, { receipt: 10 }));
  });
  it("los recibos no se editan (eliminar se prueba aparte)", async () => {
    const db = ana();
    const ref = doc(db, "businesses/bp/receipts/r1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "businesses/bp/receipts/r1"), { ...rec(1), createdAt: Timestamp.now() });
    });
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, { total: 1 }));
    await assertFails(getDoc(doc(luis(), "businesses/bp/receipts/r1")));
  });
});

describe("agenda de citas", () => {
  const appt = (extra = {}) => ({
    customerName: "María", serviceName: "Corte", price: 20000, start: Timestamp.now(), durationMin: 60,
    status: "agendada", paid: false, createdAt: serverTimestamp(), createdBy: "ana", ...extra,
  });

  it("solo Premium crea citas, y empiezan agendadas y sin pagar", async () => {
    await assertSucceeds(addDoc(collection(ana(), "businesses/bp/appointments"), appt()));
    await assertFails(addDoc(collection(ana(), "businesses/b1/appointments"), appt())); // plan Pro
    await assertFails(addDoc(collection(luis(), "businesses/bp/appointments"), appt({ createdBy: "luis" })));
    await assertFails(addDoc(collection(ana(), "businesses/bp/appointments"), appt({ paid: true })));
    await assertFails(addDoc(collection(ana(), "businesses/bp/appointments"), appt({ status: "atendida" })));
    await assertFails(addDoc(collection(ana(), "businesses/bp/appointments"), appt({ durationMin: 1 })));
  });
  it("cobrar una cita crea el recibo y la marca atendida en la misma operación", async () => {
    const db = ana();
    const apptRef = doc(db, "businesses/bp/appointments/c1");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "businesses/bp/appointments/c1"), { ...appt(), createdAt: Timestamp.now() });
    });
    const counter = doc(db, "businesses/bp/meta/counters");
    await assertSucceeds(runTransaction(db, async (t) => {
      const snap = await t.get(counter);
      const next = (snap.exists() ? snap.data().receipt : 0) + 1;
      const rRef = doc(collection(db, "businesses/bp/receipts"));
      t.set(counter, { receipt: next });
      t.set(rRef, {
        number: next, customerName: "María", items: [{ name: "Corte", qty: 1, price: 20000 }], total: 20000,
        method: "efectivo", status: "pagado", date: Timestamp.now(), createdAt: serverTimestamp(), createdBy: "ana",
      });
      t.update(apptRef, { status: "atendida", paid: true, receiptId: rRef.id });
    }));
  });
  it("no se puede cambiar quién creó la cita ni su estado a algo inválido", async () => {
    const ref = doc(ana(), "businesses/bp/appointments/c2");
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "businesses/bp/appointments/c2"), { ...appt(), createdAt: Timestamp.now() });
    });
    await assertFails(updateDoc(ref, { createdBy: "luis" }));
    await assertFails(updateDoc(ref, { status: "otra" }));
    await assertSucceeds(updateDoc(ref, { status: "cancelada" }));
  });
  it("el dueño responde el cuestionario del negocio", async () => {
    await assertSucceeds(updateDoc(doc(ana(), "businesses/bp"), { businessType: "Belleza y cuidado personal", usesAppointments: true }));
    await assertFails(updateDoc(doc(ana(), "businesses/bp"), { usesAppointments: "si" }));
  });
});

describe("datos de facturación y numeración de facturas", () => {
  const billing = (extra = {}) => ({
    mode: "factura", taxStatus: "no_responsable", taxNote: "", resolutionNumber: "18760000001",
    resolutionDate: "2026-01-10", prefix: "FV", rangeFrom: 1, rangeTo: 5, validUntil: "2027-01-10", ...extra,
  });
  const setBilling = () => env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "businesses/bp"), { billing: billing() }));

  it("solo el plan Premium guarda datos de facturación y valida el contenido", async () => {
    await assertSucceeds(updateDoc(doc(ana(), "businesses/bp"), { billing: billing() }));
    await assertFails(updateDoc(doc(ana(), "businesses/b1"), { billing: billing() }));
    await assertFails(updateDoc(doc(ana(), "businesses/bp"), { billing: billing({ prefix: "ABCDE" }) }));
    await assertFails(updateDoc(doc(ana(), "businesses/bp"), { billing: billing({ rangeTo: 0 }) }));
    await assertFails(updateDoc(doc(ana(), "businesses/bp"), { billing: billing({ mode: "otro" }) }));
    await assertFails(updateDoc(doc(ana(), "businesses/bp"), { billing: { ...billing(), extra: 1 } }));
  });
  it("el consecutivo de facturas empieza en el inicio del rango, no salta y no pasa del final", async () => {
    await setBilling();
    const counter = doc(ana(), "businesses/bp/meta/counters");
    const key = "FV|18760000001";
    await assertFails(setDoc(counter, { invoice: 3, invoiceKey: key }));
    await assertSucceeds(setDoc(counter, { invoice: 1, invoiceKey: key }));
    await assertSucceeds(setDoc(counter, { invoice: 2, invoiceKey: key }));
    await assertFails(setDoc(counter, { invoice: 4, invoiceKey: key }));
    await assertSucceeds(setDoc(counter, { invoice: 3, invoiceKey: key }));
    await assertSucceeds(setDoc(counter, { invoice: 4, invoiceKey: key }));
    await assertSucceeds(setDoc(counter, { invoice: 5, invoiceKey: key }));
    await assertFails(setDoc(counter, { invoice: 6, invoiceKey: key }));
    await assertFails(setDoc(counter, { invoice: 5, invoiceKey: "XX|otra" }));
  });
  it("con una resolución nueva la numeración reinicia en el inicio del nuevo rango", async () => {
    await setBilling();
    const counter = doc(ana(), "businesses/bp/meta/counters");
    await assertSucceeds(setDoc(counter, { invoice: 1, invoiceKey: "FV|18760000001" }));
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "businesses/bp"), { billing: billing({ resolutionNumber: "999", rangeFrom: 100, rangeTo: 200 }) }));
    await assertFails(setDoc(counter, { invoice: 2, invoiceKey: "FV|999" }));
    await assertSucceeds(setDoc(counter, { invoice: 100, invoiceKey: "FV|999" }));
  });
  it("la factura guarda los campos fiscales y rechaza campos desconocidos", async () => {
    await setBilling();
    const fiscal = { resolutionNumber: "18760000001", resolutionDate: "2026-01-10", prefix: "FV", rangeFrom: 1, rangeTo: 5, validUntil: "2027-01-10", taxStatus: "no_responsable", taxNote: "" };
    const inv = (extra = {}) => ({
      number: 1, customerName: "María", items: [{ name: "Corte", qty: 1, price: 10000, unit: "UND", ivaRate: 0 }], total: 10000,
      method: "efectivo", status: "pagado", date: Timestamp.now(), createdAt: serverTimestamp(), createdBy: "ana",
      docType: "factura", prefix: "FV", subtotal: 10000, ivaTotal: 0, fiscal, ...extra,
    });
    await assertSucceeds(addDoc(collection(ana(), "businesses/bp/receipts"), inv()));
    await assertFails(addDoc(collection(ana(), "businesses/bp/receipts"), inv({ hack: 1 })));
  });
});

describe("eliminar recibos", () => {
  const base = { number: 1, customerName: "María", items: [{ name: "x", qty: 1, price: 1000 }], total: 1000, method: "efectivo", status: "pagado", date: Timestamp.now(), createdAt: Timestamp.now(), createdBy: "ana" };
  beforeEach(() => env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "businesses/bp/receipts/r1"), base);
    await setDoc(doc(db, "businesses/bp/receipts/f1"), { ...base, number: 2, docType: "factura", prefix: "FV" });
    await setDoc(doc(db, "businesses/b1/receipts/r1"), base);
  }));
  it("un miembro Premium elimina recibos internos pero no facturas", async () => {
    await assertSucceeds(deleteDoc(doc(ana(), "businesses/bp/receipts/r1")));
    await assertFails(deleteDoc(doc(ana(), "businesses/bp/receipts/f1")));
  });
  it("un no miembro o un plan sin Premium no elimina", async () => {
    await assertFails(deleteDoc(doc(luis(), "businesses/bp/receipts/r1")));
    await assertFails(deleteDoc(doc(ana(), "businesses/b1/receipts/r1")));
  });
});

describe("cotizaciones", () => {
  const quote = (n, extra = {}) => ({
    number: n, customerName: "María", items: [{ name: "Corte", qty: 2, price: 15000 }], total: 30000,
    status: "pendiente", validUntil: Timestamp.fromMillis(Date.now() + 15 * 86400000), date: serverTimestamp(),
    createdAt: serverTimestamp(), createdBy: "ana", ...extra,
  });
  it("solo Premium crea cotizaciones, con consecutivo propio y sin saltos", async () => {
    const db = ana();
    const counter = doc(db, "businesses/bp/meta/counters");
    await assertSucceeds(runTransaction(db, async (t) => {
      t.set(counter, { quote: 1 });
      t.set(doc(collection(db, "businesses/bp/quotes")), quote(1));
    }));
    await assertFails(setDoc(counter, { quote: 5 }));
    await assertSucceeds(setDoc(counter, { quote: 2 }));
    await assertFails(addDoc(collection(ana(), "businesses/b1/quotes"), quote(1)));
    await assertFails(addDoc(collection(luis(), "businesses/bp/quotes"), quote(1, { createdBy: "luis" })));
  });
  it("nace pendiente y rechaza campos extra o datos inválidos", async () => {
    await assertFails(addDoc(collection(ana(), "businesses/bp/quotes"), quote(1, { status: "aceptada" })));
    await assertFails(addDoc(collection(ana(), "businesses/bp/quotes"), quote(1, { hack: 1 })));
    await assertFails(addDoc(collection(ana(), "businesses/bp/quotes"), quote(1, { total: 0 })));
  });
  it("solo se cambia el estado; el resto no se edita; se puede eliminar", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "businesses/bp/quotes/q1"), { ...quote(1), date: Timestamp.now(), createdAt: Timestamp.now() }));
    const ref = doc(ana(), "businesses/bp/quotes/q1");
    await assertSucceeds(updateDoc(ref, { status: "aceptada" }));
    await assertSucceeds(updateDoc(ref, { status: "aceptada", receiptId: "r1" }));
    await assertFails(updateDoc(ref, { total: 1 }));
    await assertFails(updateDoc(ref, { status: "otro" }));
    await assertFails(deleteDoc(doc(luis(), "businesses/bp/quotes/q1")));
    await assertSucceeds(deleteDoc(ref));
  });
});

