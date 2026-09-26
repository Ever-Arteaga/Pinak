import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// La API key se guarda como secreto de Firebase (nunca en el código ni en el cliente).
// Se configura una vez con: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Se usa el alias "gemini-flash-latest" (en vez de un ID de modelo fijo como
// "gemini-2.5-flash") porque Google retira modelos Flash específicos con el
// tiempo — a veces antes de la fecha de apagado anunciada. El alias siempre
// apunta al modelo Flash vigente con cuota gratuita, evitando que la función
// deje de funcionar sola cuando Google rota su catálogo.
const MODEL = "gemini-flash-latest";

const VALID_METHODS = ["efectivo", "nequi", "daviplata", "tarjeta", "transferencia"];
const VALID_TYPES = ["ingreso", "egreso"];

interface ParsedTransaction {
  type: "ingreso" | "egreso";
  amount: number;
  category: string;
  method: string;
  description?: string;
}

// emprendedor: 0 = la IA no está disponible en el plan gratuito.
// pro / premium: null = ilimitado.
const PLAN_AI_LIMITS: Record<string, number | null> = {
  emprendedor: 0,
  pro: null,
  premium: null,
};

function currentMonthId(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "No se encontró tu perfil de usuario.");
    }
    const plan = (userSnap.data()?.plan as string) ?? "emprendedor";
    const limit = PLAN_AI_LIMITS[plan] ?? PLAN_AI_LIMITS.emprendedor;

    if (limit === 0) {
      throw new HttpsError(
        "permission-denied",
        "El registro con IA está disponible en los planes Pro y Premium. Mejora tu plan para usarlo."
      );
    }

    const monthId = currentMonthId();
    const usageRef = userRef.collection("usage").doc(monthId);

    const usageAfter = await db.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      const used = (usageSnap.data()?.aiRegistrationsUsed as number) ?? 0;

      if (limit !== null && used >= limit) {
        throw new HttpsError(
          "resource-exhausted",
          `Alcanzaste el límite de ${limit} registros con IA de tu plan este mes. Mejora tu plan para uso ilimitado.`
        );
      }

      const newUsed = used + 1;
      tx.set(
        usageRef,
        {
          aiRegistrationsUsed: newUsed,
          aiRegistrationsLimit: limit,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { used: newUsed, limit };
    });

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    let raw: string;
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
    } catch (err) {
      logger.error("Error llamando a la API de Gemini", err);
      throw new HttpsError("internal", "No se pudo procesar el mensaje con IA. Intenta de nuevo.");
    }

    let parsed: unknown;
    try {
      const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      parsed = JSON.parse(cleaned);
    } catch (err) {
      logger.error("Respuesta de Gemini no es JSON válido", { raw, err });
      throw new HttpsError("internal", "La IA no devolvió un formato válido. Intenta reformular.");
    }

    if (!Array.isArray(parsed)) {
      throw new HttpsError("internal", "La IA no devolvió una lista de transacciones.");
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
      .filter((t) => t.amount > 0);

    logger.info("Transacciones detectadas por IA", { uid, count: transactions.length });

    return {
      transactions,
      usage: usageAfter,
    };
  }
);

export { createBoldCheckout, boldWebhook, downgradeExpiredPlans } from "./payments";
