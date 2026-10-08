"use client";

import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "./firebase";
import type { Diagnosis } from "@/types/pinak";

function translateError(err: FunctionsError): string {
  switch (err.code) {
    case "functions/unauthenticated":
      return "Tu sesión expiró, vuelve a iniciar sesión.";
    case "functions/internal":
    case "functions/unavailable":
    case "functions/unknown":
      return err.message && err.message !== "internal"
        ? err.message
        : "No se pudo completar la acción. Intenta de nuevo.";
    case "functions/not-found":
      // Si la función no existe, el mensaje genérico es "NOT_FOUND"; los propios del servidor son en español.
      return err.message && err.message !== "NOT_FOUND"
        ? err.message
        : "Esta función aún no está disponible. Intenta más tarde.";
    default:
      // permission-denied, resource-exhausted, failed-precondition, already-exists, invalid-argument:
      // el servidor ya devuelve el mensaje en español.
      return err.message || "No se pudo completar la acción.";
  }
}

function callable<TIn, TOut>(name: string) {
  const fn = httpsCallable<TIn, TOut>(functions, name);
  return async (data: TIn): Promise<TOut> => {
    try {
      return (await fn(data)).data;
    } catch (err) {
      throw new Error(translateError(err as FunctionsError));
    }
  };
}

export const ensureBusiness = callable<{ businessName?: string }, { businessId: string; created: boolean }>(
  "ensureBusiness"
);
export const createBusiness = callable<
  { name: string; businessType?: string; phone?: string; city?: string },
  { businessId: string }
>("createBusiness");
export const inviteMember = callable<{ businessId: string; email: string }, { inviteId: string }>(
  "inviteMember"
);
export const acceptInvite = callable<{ inviteId: string }, { businessId: string }>("acceptInvite");
export const declineInvite = callable<{ inviteId: string }, { ok: boolean }>("declineInvite");
export const cancelInvite = callable<{ inviteId: string }, { ok: boolean }>("cancelInvite");
export const removeMember = callable<{ businessId: string; memberUid: string }, { ok: boolean }>(
  "removeMember"
);

export interface GenerateDiagnosisResult extends Omit<Diagnosis, "generatedAt"> {
  maxGenerations: number;
}
export const generateDiagnosis = callable<
  { businessId: string; month: string },
  GenerateDiagnosisResult
>("generateDiagnosis");
