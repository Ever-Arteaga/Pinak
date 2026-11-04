"use client";

import type { SeriesPoint } from "@pinak/shared/dashboard";

/** Mini gráfica de barras de los últimos puntos de una serie (decorativa: el valor va en texto). */
export function MiniBars({ points, field, color }: { points: SeriesPoint[]; field: "income" | "expense"; color: string }) {
  const last = points.slice(-12);
  const max = Math.max(1, ...last.map((p) => p[field]));
  return (
    <div aria-hidden className="flex h-8 items-end gap-[3px]">
      {last.map((p) => (
        <span
          key={p.key}
          className="w-full min-w-[3px] rounded-t-[3px]"
          style={{ height: `${Math.max(p[field] > 0 ? 8 : 3, (p[field] / max) * 100)}%`, background: color, opacity: p[field] > 0 ? 1 : 0.25 }}
        />
      ))}
    </div>
  );
}
