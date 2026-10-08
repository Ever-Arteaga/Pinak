"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Diagnosis } from "@/types/pinak";

/** Diagnóstico ya generado de un mes (en tiempo real). null si todavía no existe. */
export function useDiagnosis(businessId: string | undefined, month: string, enabled: boolean) {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDiagnosis(null);
    if (!businessId || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, "businesses", businessId, "diagnostics", month),
      (snap) => {
        const x = snap.data();
        setDiagnosis(
          x
            ? {
                month: x.month,
                resumen: x.resumen ?? "",
                hallazgos: x.hallazgos ?? [],
                recomendaciones: x.recomendaciones ?? [],
                alerta: x.alerta ?? null,
                stats: x.stats,
                generationCount: x.generationCount ?? 1,
                generatedAt: x.generatedAt?.toDate ? x.generatedAt.toDate() : null,
              }
            : null
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [businessId, month, enabled]);

  return { diagnosis, loading };
}
