"use client";

import { collection, documentId, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Summary } from "@/types/pinak";

function parse(x: Record<string, unknown>): Summary {
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  const m = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, number>) : {});
  return {
    income: n(x.income),
    expense: n(x.expense),
    count: n(x.count),
    aiCount: n(x.aiCount),
    expenseByCategory: m(x.expenseByCategory),
    incomeByCategory: m(x.incomeByCategory),
    incomeByMethod: m(x.incomeByMethod),
  };
}

export const emptySummary = (): Summary => parse({});

/**
 * Resúmenes agregados entre dos ids (inclusive), p. ej. "day-2026-10-08" a "day-2026-10-14",
 * "month-2026-01" a "month-2026-10" o "all" a "all". Los mantiene un trigger del servidor,
 * así el dashboard lee pocos documentos sin importar cuántos movimientos haya.
 */
export function useSummaries(businessId: string | undefined, fromId: string, toId: string) {
  const [items, setItems] = useState<Record<string, Summary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!businessId) {
      setItems({});
      setLoading(false);
      return;
    }
    setError(null);
    const q = query(
      collection(db, "businesses", businessId, "summaries"),
      where(documentId(), ">=", fromId),
      where(documentId(), "<=", toId)
    );
    return onSnapshot(
      q,
      (snap) => {
        const next: Record<string, Summary> = {};
        snap.docs.forEach((d) => (next[d.id] = parse(d.data())));
        setItems(next);
        setLoading(false);
      },
      (err) => {
        console.error("No se pudieron cargar los resúmenes:", err);
        setError("No pudimos cargar tus datos. Revisa tu conexión e intenta de nuevo.");
        setLoading(false);
      }
    );
  }, [businessId, fromId, toId, attempt]);

  const retry = () => {
    setLoading(true);
    setAttempt((n) => n + 1);
  };
  return { items, loading, error, retry };
}

/** Totales de todo el historial. */
export function useAllTimeSummary(businessId: string | undefined) {
  const { items, loading, error, retry } = useSummaries(businessId, "all", "all");
  return { summary: items.all ?? emptySummary(), loading, error, retry };
}

/** Id del resumen diario de una fecha (hora local del dispositivo). */
export function dayId(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `day-${y}-${m}-${day}`;
}
