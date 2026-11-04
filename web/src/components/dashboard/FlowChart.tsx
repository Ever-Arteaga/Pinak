"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCompactCOP, type SeriesPoint } from "@pinak/shared/dashboard";

const INCOME = "var(--pinak-bar-income)";
const EXPENSE = "var(--pinak-bar-expense)";

/** Máximo "redondo" para el eje: 1, 2, 2,5, 5 o 10 × 10^k. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

export function FlowChart({
  series,
  money,
  masked,
}: {
  series: SeriesPoint[];
  /** Monto completo (respeta el modo privacidad). */
  money: (n: number) => string;
  /** true si el modo privacidad oculta los montos. */
  masked: boolean;
}) {
  const lastKey = series[series.length - 1]?.key;
  const [selected, setSelected] = useState<string | undefined>(lastKey);

  // Al cambiar de período, vuelve a quedar seleccionado el último punto.
  const firstKey = series[0]?.key;
  useEffect(() => setSelected(lastKey), [lastKey, firstKey]);

  const max = useMemo(() => niceMax(Math.max(0, ...series.flatMap((p) => [p.income, p.expense]))), [series]);
  const compact = (n: number) => (masked ? "$ •••" : formatCompactCOP(n));
  const current = series.find((p) => p.key === selected) ?? series[series.length - 1];
  const labelEvery = series.length > 14 ? 5 : 1;
  const guides = [1, 2 / 3, 1 / 3, 0];

  if (!current) return null;

  return (
    <div>
      {/* Franja con el detalle del punto seleccionado */}
      <div
        className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-cream px-3 py-2 text-xs text-ink"
        aria-live="polite"
      >
        <span className="font-semibold text-navy-900">{current.fullLabel}</span>
        <span>
          <span aria-hidden style={{ color: INCOME }}>▲ </span>Ingresos <strong>{money(current.income)}</strong>
        </span>
        <span>
          <span aria-hidden style={{ color: EXPENSE }}>▼ </span>Egresos <strong>{money(current.expense)}</strong>
        </span>
        <span>
          Neto <strong>{masked ? money(0) : `${current.income - current.expense < 0 ? "-" : ""}${money(Math.abs(current.income - current.expense))}`}</strong>
        </span>
      </div>

      {/* Leyenda en texto (los colores nunca son la única pista) */}
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE }} /> Egresos
        </span>
      </div>

      <div className="flex">
        {/* Eje con etiquetas compactas */}
        <div aria-hidden className="relative mr-2 w-14 shrink-0" style={{ height: 180 }}>
          {guides.map((g) => (
            <span
              key={g}
              className="absolute right-0 -translate-y-1/2 text-[10px] text-ink-soft"
              style={{ top: `${(1 - g) * 100}%` }}
            >
              {compact(max * g)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: 180 }}>
            {guides.map((g) => (
              <div
                key={g}
                aria-hidden
                className="absolute inset-x-0 border-t border-dashed border-line"
                style={{ top: `${(1 - g) * 100}%` }}
              />
            ))}
            <div role="group" aria-label="Flujo de caja por período" className="relative flex h-full items-end gap-[2px]">
              {series.map((p) => {
                const isSel = p.key === current.key;
                const h = (v: number) => (v > 0 ? Math.max(2, (v / max) * 100) : 0);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setSelected(p.key)}
                    aria-pressed={isSel}
                    aria-label={`${p.fullLabel}: ingresos ${money(p.income)}, egresos ${money(p.expense)}`}
                    className={`group flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-md px-[1px] outline-none transition focus-visible:ring-2 focus-visible:ring-green-500 ${
                      isSel ? "bg-cream" : "hover:bg-cream/70"
                    }`}
                  >
                    <span className="w-full max-w-[18px] rounded-t-[4px]" style={{ height: `${h(p.income)}%`, background: INCOME }} />
                    <span className="w-full max-w-[18px] rounded-t-[4px]" style={{ height: `${h(p.expense)}%`, background: EXPENSE }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Etiquetas del eje X */}
          <div aria-hidden className="mt-1.5 flex gap-[2px]">
            {series.map((p, i) => {
              const show = (series.length - 1 - i) % labelEvery === 0;
              return (
                <span
                  key={p.key}
                  className={`min-w-0 flex-1 text-center text-[10px] ${p.key === current.key ? "font-semibold text-navy-900" : "text-ink-soft"}`}
                >
                  {show ? p.shortLabel : ""}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vista en tabla para lectores de pantalla */}
      <table className="sr-only">
        <caption>Flujo de caja por período</caption>
        <thead>
          <tr><th>Período</th><th>Ingresos</th><th>Egresos</th></tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.key}><td>{p.fullLabel}</td><td>{money(p.income)}</td><td>{money(p.expense)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
