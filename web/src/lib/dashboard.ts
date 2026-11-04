"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeDashboard,
  periodSpec,
  summarizeReceivables,
  type DashboardData,
  type DashboardPeriod,
  type ReceivablesSummary,
} from "@pinak/shared/dashboard";
import { useReceivables } from "./receivables";
import { useSummaries } from "./summaries";
import { useTransactions } from "./transactions";
import type { Transaction } from "@/types/pinak";

export type { DashboardData, DashboardPeriod, ReceivablesSummary };

/** Hora actual redondeada al minuto: así el "hoy" del dashboard se actualiza solo al pasar la medianoche. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 60_000) * 60_000), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export interface DashboardState {
  period: DashboardPeriod;
  nowMs: number;
  data: DashboardData;
  receivables: ReceivablesSummary;
  /** Las últimas 20 transacciones (de más nueva a más vieja); incluyen `source`. */
  recent: Transaction[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Todo lo que necesita el dashboard. Los totales y la gráfica salen de los resúmenes
 * (día o mes según el período), nunca de todo el historial; además se escuchan los
 * fiados y los 20 movimientos más recientes.
 */
export function useDashboard(businessId: string | undefined, period: DashboardPeriod): DashboardState {
  const nowMs = useMinuteClock();
  const spec = useMemo(() => periodSpec(period, nowMs), [period, nowMs]);

  const summaries = useSummaries(businessId, spec.fromId, spec.toId);
  const tx = useTransactions(businessId, { limit: 20 });
  const rec = useReceivables(businessId);

  const data = useMemo(() => computeDashboard(period, nowMs, summaries.items), [period, nowMs, summaries.items]);
  const receivables = useMemo(() => summarizeReceivables(rec.receivables, nowMs), [rec.receivables, nowMs]);

  return {
    period,
    nowMs,
    data,
    receivables,
    recent: tx.transactions,
    loading: summaries.loading || tx.loading || rec.loading,
    error: summaries.error ?? tx.error ?? rec.error,
    retry: () => {
      summaries.retry();
      tx.retry();
      rec.retry();
    },
  };
}
