"use client";

import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "./firebase";
import type { PaymentMethod, TransactionType } from "@/types/pinak";

export interface AiParsedTransaction {
  type: TransactionType;
  amount: number;
  category: string;
  method: PaymentMethod;
  description?: string;
}

interface ParseTransactionTextResult {
  transactions: AiParsedTransaction[];
  usage: { used: number; limit: number | null };
}

export async function parseTransactionText(text: string, businessId: string): Promise<ParseTransactionTextResult> {
  const callable = httpsCallable<{ text: string; businessId: string }, ParseTransactionTextResult>(
    functions,
    "parseTransactionText"
  );

  try {
    const result = await callable({ text, businessId });
    return result.data;
  } catch (err) {
    const fnError = err as FunctionsError;
    throw new Error(traducirErrorIA(fnError));
  }
}

function traducirErrorIA(err: FunctionsError): string {
  switch (err.code) {
    case "functions/resource-exhausted":
      return err.message;
    case "functions/permission-denied":
      return err.message;
    case "functions/unauthenticated":
      return "Tu sesión expiró, vuelve a iniciar sesión.";
    case "functions/invalid-argument":
      return err.message || "El mensaje no es válido.";
    case "functions/internal":
      return err.message || "No se pudo procesar el mensaje. Intenta de nuevo.";
    default:
      return "No se pudo conectar con el asistente IA. Intenta de nuevo.";
  }
}
