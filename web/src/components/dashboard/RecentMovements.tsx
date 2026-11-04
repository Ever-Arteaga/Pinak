"use client";

import Link from "next/link";
import { useState } from "react";
import { methodLabel, relativeTime, sourceLabel } from "@pinak/shared/dashboard";
import type { Transaction } from "@/types/pinak";

type Filter = "todos" | "ingreso" | "egreso";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ingreso", label: "Ingresos" },
  { id: "egreso", label: "Egresos" },
];

export function RecentMovements({
  transactions,
  nowMs,
  money,
  onSelect,
  limit = 8,
}: {
  transactions: Transaction[];
  nowMs: number;
  money: (n: number) => string;
  onSelect: (t: Transaction) => void;
  limit?: number;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const rows = transactions.filter((t) => filter === "todos" || t.type === filter).slice(0, limit);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-navy-900">Movimientos recientes</h2>
        <div role="group" aria-label="Filtrar movimientos" className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold transition ${
                filter === f.id ? "border-navy-900 bg-navy-900 text-white" : "border-line text-ink-soft hover:bg-cream"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">No hay movimientos de este tipo.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((t) => {
            const income = t.type === "ingreso";
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-lg py-2 text-left transition hover:bg-cream"
                >
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      income ? "bg-green-100 text-green-600" : "bg-red-50 text-danger"
                    }`}
                  >
                    {income ? "↗" : "↙"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{t.category}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {methodLabel(t.method)} · {relativeTime(t.date.getTime(), nowMs)}
                    </span>
                  </span>
                  <span
                    className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${
                      t.source === "manual" ? "bg-cream text-ink-soft" : "bg-navy-900 text-white"
                    }`}
                  >
                    {sourceLabel(t.source)}
                  </span>
                  <span className={`shrink-0 text-sm font-semibold ${income ? "text-green-600" : "text-danger"}`}>
                    {income ? "+" : "-"}
                    {money(t.amount)}
                    <span className="sr-only">{income ? " ingreso" : " egreso"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        prefetch={false}
        href="/reportes"
        className="mt-2 flex min-h-[44px] items-center justify-center rounded-lg text-sm font-semibold text-navy-900 transition hover:bg-cream"
      >
        Ver todos los movimientos →
      </Link>
    </div>
  );
}
