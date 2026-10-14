import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { geminiApiKey, MODEL } from "./gemini";
import { normalizePlan, PLAN_LIMITS } from "./plans";
import { monthIdOf, dayIdOf } from "./diagnosisStats";

// Tope diario de registros con IA por negocio (protege la cuota de Gemini).
const AI_DAILY_CAP = 300;

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const VALID_METHODS = ["efectivo", "nequi", "daviplata", "tarjeta", "transferencia"];
const VALID_TYPES = ["ingreso", "egreso"];
const MAX_AMOUNT = 1_000_000_000;

interface ParsedTransaction {
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  method: string;
  description?: string;
}

function currentMonthId(): string {
  return monthIdOf(Date.now());
}

const SYSTEM_PROMPT = `Eres el motor de registro contable de PINAK, una app financiera para pequeños negocios en Colombia.

Tu única tarea: leer un mensaje en lenguaje natural (texto o transcripción de voz) donde el usuario describe uno o más movimientos de dinero de su negocio, y devolver EXCLUSIVAMENTE un JSON válido con la lista de transacciones detectadas. Nada de texto antes o después del JSON.

Formato de salida (array, incluso si es una sola transacción):
[
  {
    "type": "ingreso" | "egreso",
    "amount": <número positivo, sin puntos ni comas>,
    "category": "<categoría breve en español, ej: Ventas, Insumos, Transporte, Nómina, Arriendo>",
    "method": "efectivo" | "nequi" | "daviplata" | "tarjeta" | "transferencia",
    "description": "<opcional, detalle breve si el usuario lo dio>"
  }
]

Reglas:
- Si el usuario menciona una venta, cobro, pago recibido → type "ingreso".
- Si menciona un gasto, compra, pago realizado → type "egreso".
- Si no se menciona el método de pago, usa "efectivo" por defecto.
- Los montos en Colombia suelen escribirse como "60.000" o "60000" (sesenta mil pesos) — interpreta el punto como separador de miles, no decimal, a menos que el contexto indique centavos.
- Si el mensaje no contiene ninguna transacción identificable, devuelve un array vacío: []
- Nunca inventes montos ni categorías que no estén implícitas en el mensaje.
- No agregues explicaciones, comentarios ni markdown. Solo el array JSON.`;

export const parseTransactionText = onCall(
  { secrets: [geminiApiKey], region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para usar esta función.");
    }

    const uid = request.auth.uid;
    const text = (request.data?.text ?? "").toString().trim();

    if (!text) {
      throw new HttpsError("invalid-argument", "El mensaje está vacío.");
    }
    if (text.length > 1000) {
      throw new HttpsError("invalid-argument", "El mensaje es demasiado largo.");
    }

    // El plan que cuenta es el del NEGOCIO (el de su dueño): las personas
    // invitadas heredan los beneficios dentro de ese negocio.
    const businessId = String(request.data?.businessId ?? uid).trim();
    const bizRef = db.collection("businesses").doc(businessId);
    const bizSnap = await bizRef.get();
    if (!bizSnap.exists) {
      throw new HttpsError("not-found", "No se encontró el negocio.");
    }
    const biz = bizSnap.data()!;
    if (!((biz.memberIds ?? []) as string[]).includes(uid)) {
      throw new HttpsError("permission-denied", "No eres parte de este negocio.");
    }
    if (biz.locked === true) {
      throw new HttpsError(
        "failed-precondition",
        "Este negocio está bloqueado porque su plan venció. Pídele al dueño que lo renueve."
      );
    }
    if (!PLAN_LIMITS[normalizePlan(biz.plan)].ai) {
      throw new HttpsError(
        "permission-denied",
        "El registro con IA está disponible en los planes Pro y Premium. Mejora tu plan para usarlo."
      );
    }

    // Contador de uso, atómico: suma el mes y aplica el tope diario por negocio.
    const usageRef = bizRef.collection("usage").doc(currentMonthId());
    const dayRef = bizRef.collection("usage").doc(`day-${dayIdOf(Date.now())}`);
    const used = await db.runTransaction(async (tx) => {
      const [usageSnap, daySnap] = await Promise.all([tx.get(usageRef), tx.get(dayRef)]);
      const today = ((daySnap.data()?.aiRegistrationsUsed as number) ?? 0) + 1;
      if (today > AI_DAILY_CAP) {
        throw new HttpsError(
          "resource-exhausted",
          "Llegaste al límite diario de registros con IA. Intenta de nuevo mañana."
        );
      }
      const monthly = ((usageSnap.data()?.aiRegistrationsUsed as number) ?? 0) + 1;
      tx.set(
        usageRef,
        { aiRegistrationsUsed: monthly, aiRegistrationsLimit: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      tx.set(dayRef, { aiRegistrationsUsed: today, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return monthly;
    });
    const usageAfter = { used, limit: null as number | null };

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    let raw = "[]";
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: text,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
          },
        });
        raw = response.text ?? "[]";
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        logger.warn("Fallo al llamar a Gemini", { attempt, err });
      }
    }
    if (lastErr) {
      logger.error("Error llamando a la API de Gemini", lastErr);
      throw new HttpsError("unavailable", "El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.");
    }

    let parsed: unknown;
    try {
      const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      parsed = JSON.parse(cleaned);
    } catch (err) {
      logger.error("Respuesta de Gemini no es JSON válido", { raw, err });
      throw new HttpsError("failed-precondition", "No pude entender el mensaje. Intenta escribirlo de otra forma, con montos y si fue ingreso o gasto.");
    }

    if (!Array.isArray(parsed)) {
      throw new HttpsError("failed-precondition", "No pude entender el mensaje. Intenta escribirlo de otra forma.");
    }

    const transactions: ParsedTransaction[] = parsed
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => ({
        type: VALID_TYPES.includes(String(t.type)) ? (t.type as "ingreso" | "egreso") : "egreso",
        amount: Math.abs(Number(t.amount) || 0),
        category: String(t.category || "Otros").slice(0, 60),
        method: VALID_METHODS.includes(String(t.method)) ? String(t.method) : "efectivo",
        description: t.description ? String(t.description).slice(0, 200) : undefined,
      }))
      .filter((t) => t.amount > 0)
      .slice(0, 20);

    // Revisiones de coherencia: el servidor avisa, la persona decide.
    const warnings: string[] = [];
    const cop = (n: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
    const ingresos = transactions.filter((t) => t.type === "ingreso").reduce((a, t) => a + t.amount, 0);
    const egresos = transactions.filter((t) => t.type === "egreso").reduce((a, t) => a + t.amount, 0);
    if (ingresos > 0 && egresos > ingresos) {
      warnings.push(
        `Los gastos (${cop(egresos)}) superan a las ventas (${cop(ingresos)}) en este mensaje. Revisa que los montos estén bien escritos.`
      );
    }
    for (const t of transactions) {
      if (t.amount > MAX_AMOUNT) {
        warnings.push(`El monto ${cop(t.amount)} es muy alto. Revisa que no tenga ceros de más.`);
        t.amount = MAX_AMOUNT;
      }
    }

    logger.info("Transacciones detectadas por IA", { uid, count: transactions.length });

    return {
      transactions,
      usage: usageAfter,
      warnings,
    };
  }
);

export { createBoldCheckout, boldWebhook, downgradeExpiredPlans } from "./payments";
export {
  ensureBusiness,
  createBusiness,
  inviteMember,
  acceptInvite,
  declineInvite,
  cancelInvite,
  removeMember,
} from "./businesses";
export { generateDiagnosis } from "./diagnosis";
export { startTrial } from "./trials";
