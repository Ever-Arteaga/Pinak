/**
 * Recalcula los resúmenes (day-*, month-*, all) de TODOS los negocios a partir de sus
 * transacciones. Se corre una sola vez, después de desplegar el trigger.
 *
 *   cd functions
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\a\cuenta-de-servicio.json"   (PowerShell)
 *   npm run backfill            # recalcula todo
 *   npm run backfill -- <id>    # recalcula solo ese negocio
 *
 * Los resúmenes se SOBRESCRIBEN con el valor exacto, así que repetirlo es seguro.
 * Conviene correrlo con poca actividad: un movimiento creado justo durante el recálculo
 * podría contarse dos veces (se corrige repitiendo el script).
 */
import * as admin from "firebase-admin";
import { buildSummaries, type SummaryTx } from "../src/summaryCalc";

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "pinak-dev" });
const db = admin.firestore();
const PAGE = 1000;

async function backfillBusiness(businessId: string) {
  const base = db.collection("businesses").doc(businessId);
  const txs: SummaryTx[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = base.collection("transactions").orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    for (const d of snap.docs) {
      const ms = d.get("date")?.toMillis?.();
      if (typeof ms !== "number") continue;
      txs.push({
        type: d.get("type") === "ingreso" ? "ingreso" : "egreso",
        amount: Number(d.get("amount")) || 0,
        category: String(d.get("category") ?? "Otros"),
        method: String(d.get("method") ?? "efectivo"),
        source: String(d.get("source") ?? "manual"),
        dateMs: ms,
      });
    }
    if (snap.size < PAGE) break;
    last = snap.docs[snap.docs.length - 1];
  }

  const built = buildSummaries(txs);

  // Se borran los resúmenes anteriores y se escriben los nuevos.
  const old = await base.collection("summaries").listDocuments();
  const writer = db.bulkWriter();
  old.forEach((ref) => writer.delete(ref));
  for (const [id, s] of Object.entries(built)) {
    writer.set(base.collection("summaries").doc(id), { ...s, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  await writer.close();
  console.log(`✔ ${businessId}: ${txs.length} movimientos → ${Object.keys(built).length} resúmenes`);
}

async function main() {
  const only = process.argv[2];
  if (only) {
    await backfillBusiness(only);
    return;
  }
  const businesses = await db.collection("businesses").select().get();
  console.log(`Negocios: ${businesses.size}`);
  for (const b of businesses.docs) await backfillBusiness(b.id);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
