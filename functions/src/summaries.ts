import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { txDelta, type SummaryTx } from "./summaryCalc";
import type { SummaryDoc } from "./diagnosisStats";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;

function toTx(data: FirebaseFirestore.DocumentData | undefined): SummaryTx | null {
  if (!data) return null;
  const ms = data.date?.toMillis?.();
  if (typeof ms !== "number") return null;
  return {
    type: data.type === "ingreso" ? "ingreso" : "egreso",
    amount: Number(data.amount) || 0,
    category: String(data.category ?? "Otros"),
    method: String(data.method ?? "efectivo"),
    source: typeof data.source === "string" ? data.source : "manual",
    dateMs: ms,
  };
}

function mapInc(m: Record<string, number>): Record<string, FirebaseFirestore.FieldValue> {
  const o: Record<string, FirebaseFirestore.FieldValue> = {};
  for (const [k, v] of Object.entries(m)) if (v !== 0) o[k] = FieldValue.increment(v);
  return o;
}

/**
 * Mantiene businesses/{id}/summaries/{day-YYYY-MM-DD | month-YYYY-MM | all} con
 * increment(): crear suma, editar resta lo anterior y suma lo nuevo, borrar resta.
 * El id del evento se guarda para que un reintento de Firestore no cuente dos veces.
 */
export const onTransactionWritten = onDocumentWritten(
  { document: "businesses/{businessId}/transactions/{transactionId}", region: "us-central1" },
  async (event) => {
    const before = toTx(event.data?.before?.data());
    const after = toTx(event.data?.after?.data());
    const delta = txDelta(before, after);
    const ids = Object.keys(delta);
    if (ids.length === 0) return;

    const { businessId } = event.params;
    const base = db.collection("businesses").doc(businessId);

    // Al borrar una cuenta se borran sus movimientos: no hay que recrear resúmenes de un negocio
    // que ya no existe o que se está eliminando.
    if (!event.data?.after?.exists) {
      const biz = await base.get();
      if (!biz.exists || biz.get("deleting") === true) return;
    }
    const eventRef = base.collection("summaryEvents").doc(event.id);

    await db.runTransaction(async (tx) => {
      if ((await tx.get(eventRef)).exists) return; // ya procesado
      tx.set(eventRef, {
        // Activa una política TTL sobre este campo para limpiar la colección sola.
        expireAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      for (const id of ids) {
        const d: SummaryDoc = delta[id];
        tx.set(
          base.collection("summaries").doc(id),
          {
            income: FieldValue.increment(d.income),
            expense: FieldValue.increment(d.expense),
            count: FieldValue.increment(d.count),
            aiCount: FieldValue.increment(d.aiCount),
            expenseByCategory: mapInc(d.expenseByCategory),
            incomeByCategory: mapInc(d.incomeByCategory),
            incomeByMethod: mapInc(d.incomeByMethod),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    });
    logger.info("Resúmenes actualizados", { businessId, docs: ids.length });
  }
);
