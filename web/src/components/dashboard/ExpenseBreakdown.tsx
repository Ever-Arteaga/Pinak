"use client";

import { formatPercent, methodLabel, type Share } from "@pinak/shared/dashboard";

const SALMON = "var(--pinak-bar-expense)";
const DANGER = "var(--pinak-danger)";
const METHOD_COLORS = ["var(--pinak-bar-income)", "#5a61c9", "var(--pinak-bar-expense)", "#8a8fb8", "#c9b458"];

/** "¿En qué se va la plata?" (gasto por categoría) y "Cómo te pagan" (ingresos por medio de pago). */
export function ExpenseBreakdown({
  categories,
  methods,
  money,
  maxCategories = 6,
}: {
  categories: Share[];
  methods: Share[];
  money: (n: number) => string;
  maxCategories?: number;
}) {
  const top = categories.slice(0, maxCategories);
  const biggest = top[0]?.amount ?? 1;

  return (
    <div>
      <h2 className="font-display text-base font-semibold text-navy-900">¿En qué se va la plata?</h2>
      {top.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Sin gastos en este período.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {top.map((c, i) => (
            <li key={c.name}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-ink">{c.name}</span>
                <span className="shrink-0 text-xs text-ink-soft">
                  <span className="font-semibold text-ink">{money(c.amount)}</span> · {formatPercent(c.pct)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(3, (c.amount / biggest) * 100)}%`, background: i === 0 ? DANGER : SALMON }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="font-display mt-6 text-sm font-semibold text-navy-900">Cómo te pagan</h3>
      {methods.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Sin ingresos en este período.</p>
      ) : (
        <>
          <div className="mt-2 flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={methods.map((m) => `${methodLabel(m.name)} ${formatPercent(m.pct)}`).join(", ")}>
            {methods.map((m, i) => (
              <span key={m.name} style={{ width: `${m.pct}%`, background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            {methods.map((m, i) => (
              <li key={m.name} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                {methodLabel(m.name)} <span className="font-semibold text-ink">{formatPercent(m.pct)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
