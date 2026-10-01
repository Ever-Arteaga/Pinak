"use client";

import { useMemo, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { useTransactions, computeBalance } from "@/lib/transactions";
import { exportTransactionsToExcel, exportTransactionsToPdf } from "@/lib/reports";
import { AppHeader } from "@/components/AppHeader";
import { BarChart } from "@/components/BarChart";
import { localDateKey } from "@/lib/dates";
import type { Transaction } from "@/types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type Range = "7d" | "30d" | "month" | "all";

const RANGE_LABELS: Record<Range, string> = {
  "7d": "7 días",
  "30d": "30 días",
  month: "Este mes",
  all: "Todo",
};

function agruparParaGrafica(transactions: Transaction[], range: Range) {
  const granularidad = range === "7d" ? "dia" : range === "all" ? "mes" : "semana";
  const buckets = new Map<
    string,
    { label: string; ingreso: number; egreso: number; orden: number }
  >();

  transactions.forEach((t) => {
    let clave: string;
    let label: string;
    let orden: number;

    if (granularidad === "dia") {
      clave = localDateKey(t.date);
      label = t.date.toLocaleDateString("es-CO", { weekday: "short" });
      orden = t.date.getTime();
    } else if (granularidad === "semana") {
      const inicioSemana = new Date(t.date);
      inicioSemana.setDate(t.date.getDate() - t.date.getDay());
      clave = localDateKey(inicioSemana);
      label = `${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1}`;
      orden = inicioSemana.getTime();
    } else {
      clave = `${t.date.getFullYear()}-${t.date.getMonth()}`;
      label = t.date.toLocaleDateString("es-CO", { month: "short" });
      orden = t.date.getFullYear() * 12 + t.date.getMonth();
    }

    if (!buckets.has(clave)) {
      buckets.set(clave, { label, ingreso: 0, egreso: 0, orden });
    }
    const bucket = buckets.get(clave)!;
    if (t.type === "ingreso") bucket.ingreso += t.amount;
    else bucket.egreso += t.amount;
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.orden - b.orden)
    .slice(-10); // máximo 10 barras para que se vea bien en móvil
}

export default function ReportsPage() {
  const { user } = useAuthUser();
  const { transactions, loading } = useTransactions(user?.uid);
  const [range, setRange] = useState<Range>("30d");

  const filtered = useMemo(() => {
    if (range === "all") return transactions;
    const now = new Date();
    let start: Date;
    if (range === "7d") {
      start = new Date(now);
      start.setDate(now.getDate() - 7);
    } else if (range === "30d") {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return transactions.filter((t) => t.date >= start);
  }, [transactions, range]);

  if (!user) return null;

  const { balance, totalIngresos, totalEgresos } = computeBalance(filtered);
  const businessName = user.displayName || "Mi negocio";
  const datosGrafica = agruparParaGrafica(filtered, range);

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Reportes" />

      <div className="mx-auto max-w-md px-5 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                range === r
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-line text-ink hover:bg-white"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        <section className="mt-4 rounded-2xl bg-navy-900 p-6 text-white shadow-sm">
          <p className="text-sm text-white/70">Balance del periodo</p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {currency.format(balance)}
          </p>
          <div className="mt-5 flex gap-6">
            <div>
              <p className="text-xs text-white/60">Ingresos</p>
              <p className="text-sm font-medium text-green-500">
                {currency.format(totalIngresos)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Egresos</p>
              <p className="text-sm font-medium text-red-300">
                {currency.format(totalEgresos)}
              </p>
            </div>
          </div>
        </section>

        {/* Gráfica de ingresos vs egresos del periodo */}
        <section className="mt-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-navy-900">
            Movimientos por periodo
          </h2>
          <div className="mt-3">
            <BarChart data={datosGrafica} formatValue={(v) => currency.format(v)} />
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => exportTransactionsToPdf(businessName, filtered)}
            disabled={filtered.length === 0}
            className="rounded-xl border border-line bg-white py-3 text-sm font-semibold text-navy-900 transition hover:bg-green-100 disabled:opacity-50"
          >
            Exportar PDF
          </button>
          <button
            onClick={() => exportTransactionsToExcel(businessName, filtered)}
            disabled={filtered.length === 0}
            className="rounded-xl border border-line bg-white py-3 text-sm font-semibold text-navy-900 transition hover:bg-green-100 disabled:opacity-50"
          >
            Exportar Excel
          </button>
        </div>

        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Movimientos del periodo ({filtered.length})
          </h2>

          <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-ink-soft">Cargando...</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-ink-soft">
                No hay movimientos en este periodo.
              </p>
            )}
            {filtered.slice(0, 20).map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{t.category}</p>
                  <p className="text-xs text-ink-soft">
                    {t.date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    t.type === "ingreso" ? "text-green-600" : "text-danger"
                  }`}
                >
                  {t.type === "ingreso" ? "+" : "-"}
                  {currency.format(t.amount)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
