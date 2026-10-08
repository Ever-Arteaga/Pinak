import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { geminiApiKey, MODEL } from "./gemini";
import { normalizePlan, PLAN_LIMITS } from "./plans";
import {
  computeStats,
  isValidMonthId,
  monthIdOf,
  monthRange,
  previousMonthId,
  sanitizeDiagnosisText,
  type ReceivableInput,
  type TxInput,
} from "./diagnosisStats";
import { tsMs } from "./businesses";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

/** Tope de generaciones por negocio y mes: controla el costo de la IA. */
const MAX_GENERATIONS_PER_MONTH = 3;

const SYSTEM_PROMPT = `Eres el analista financiero de PINAK, una app para pequeños negocios en Colombia. Recibes las cifras YA CALCULADAS de un mes de un negocio y escribes un diagnóstico claro para su dueño, que no es experto en finanzas.

Devuelve EXCLUSIVAMENTE un JSON válido con esta forma, sin texto antes ni después ni markdown:
{
  "resumen": "<2 o 3 frases: cómo le fue al negocio este mes>",
  "hallazgos": ["<3 a 5 observaciones concretas basadas en las cifras>"],
  "recomendaciones": ["<2 a 4 acciones concretas y realistas para un negocio pequeño>"],
  "alerta": "<una advertencia importante si la hay, o null>"
}

Reglas estrictas:
- Usa ÚNICAMENTE los números que recibes. No calcules ni inventes cifras nuevas, no inventes comparaciones ni causas que no se vean en los datos.
- Si "previous" y "change" son null, no hay mes anterior con datos: no compares.
- Los montos son pesos colombianos (COP). Escríbelos como $1.250.000.
- Tono cercano, claro y respetuoso, sin jerga financiera. Tutea al dueño del negocio.
- Prioriza lo que más impacta: margen, categorías de gasto que más pesan, cambios frente al mes anterior y fiados vencidos.
- Si el balance es negativo o el margen es bajo o negativo, usa "alerta". Si los fiados vencidos son relevantes frente a los ingresos, menciónalo.
- No des asesoría legal, tributaria ni de inversión. No prometas resultados.
- Si no hay nada grave, "alerta" debe ser null.`;

export const generateDiagnosis = onCall(
  { secrets: [geminiApiKey], region: "us-central1", timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para usar esta función.");
    }
    const uid = request.auth.uid;

    const businessId = String(request.data?.businessId ?? "").trim();
    if (!businessId) throw new HttpsError("invalid-argument", "Falta el negocio.");

    const nowMs = Date.now();
    const currentMonth = monthIdOf(nowMs);
    const month = request.data?.month ?? currentMonth;
    if (!isValidMonthId(month) || (month !== currentMonth && month !== previousMonthId(currentMonth))) {
      throw new HttpsError("invalid-argument", "Solo se puede analizar el mes actual o el anterior.");
    }

    const bizRef = db.doc(`businesses/${businessId}`);
    const bizSnap = await bizRef.get();
    if (!bizSnap.exists) throw new HttpsError("not-found", "No se encontró el negocio.");
    const biz = bizSnap.data()!;

    if (!((biz.memberIds ?? []) as string[]).includes(uid)) {
      throw new HttpsError("permission-denied", "No eres parte de este negocio.");
    }
    if (biz.locked === true) {
      throw new HttpsError("failed-precondition", "Este negocio está bloqueado porque su plan venció.");
    }
    if (!PLAN_LIMITS[normalizePlan(biz.plan)].diagnosis) {
      throw new HttpsError(
        "permission-denied",
        "El diagnóstico financiero con IA está disponible en el plan Premium."
      );
    }

    const diagRef = bizRef.collection("diagnostics").doc(month);
    const prevCount = Number((await diagRef.get()).get("generationCount") ?? 0);
    if (prevCount >= MAX_GENERATIONS_PER_MONTH) {
      throw new HttpsError(
        "resource-exhausted",
        `Ya generaste el diagnóstico de este mes ${MAX_GENERATIONS_PER_MONTH} veces. Usa el que ya tienes.`
      );
    }

    // --- Datos del mes y del mes anterior ---
    const { startMs, endMs } = monthRange(month);
    const prev = monthRange(previousMonthId(month));
    const txQuery = (from: number, to: number) =>
      db
        .collection(`businesses/${businessId}/transactions`)
        .where("date", ">=", Timestamp.fromMillis(from))
        .where("date", "<", Timestamp.fromMillis(to))
        .limit(5000)
        .get();

    const [txSnap, prevSnap, recSnap] = await Promise.all([
      txQuery(startMs, endMs),
      txQuery(prev.startMs, prev.endMs),
      db
        .collection(`businesses/${businessId}/receivables`)
        .where("status", "in", ["pendiente", "vencido"])
        .limit(1000)
        .get(),
    ]);

    if (txSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        "No hay movimientos registrados en ese mes para analizar."
      );
    }

    const toTx = (d: admin.firestore.QueryDocumentSnapshot): TxInput => ({
      type: d.get("type") === "ingreso" ? "ingreso" : "egreso",
      amount: Number(d.get("amount")) || 0,
      category: String(d.get("category") || "Otros"),
      method: String(d.get("method") || "efectivo"),
      dateMs: tsMs(d.get("date")),
    });
    const receivables: ReceivableInput[] = recSnap.docs.map((d) => ({
      amount: Number(d.get("amount")) || 0,
      status: String(d.get("status")),
      dueDateMs: d.get("dueDate") ? tsMs(d.get("dueDate")) : null,
    }));

    const stats = computeStats({
      month,
      transactions: txSnap.docs.map(toTx),
      previousTransactions: prevSnap.docs.map(toTx),
      receivables,
      nowMs,
    });

    // --- Redacción con Gemini: recibe cifras ya calculadas ---
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    let raw: string;
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: JSON.stringify({
          negocio: { nombre: biz.name, tipo: biz.businessType || "no especificado" },
          estadisticas: stats,
        }),
        config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json" },
      });
      raw = response.text ?? "";
    } catch (err) {
      logger.error("Error llamando a Gemini para el diagnóstico", err);
      throw new HttpsError("internal", "No se pudo generar el diagnóstico. Intenta de nuevo.");
    }

    let text;
    try {
      const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      text = sanitizeDiagnosisText(JSON.parse(cleaned));
    } catch (err) {
      logger.error("Respuesta del diagnóstico no es JSON válido", { raw, err });
      text = null;
    }
    if (!text) {
      throw new HttpsError("internal", "La IA no devolvió un diagnóstico válido. Intenta de nuevo.");
    }

    // El contador solo sube si la generación fue exitosa.
    const generationCount = prevCount + 1;
    await diagRef.set({
      month,
      ...text,
      stats,
      generationCount,
      generatedBy: uid,
      generatedAt: Timestamp.now(),
    });

    logger.info("Diagnóstico generado", { businessId, month, generationCount });

    return {
      month,
      ...text,
      stats,
      generationCount,
      maxGenerations: MAX_GENERATIONS_PER_MONTH,
    };
  }
);
