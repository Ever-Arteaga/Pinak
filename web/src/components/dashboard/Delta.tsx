"use client";

import { deltaTone, formatPctChange, formatPoints, type DeltaMetric } from "@pinak/shared/dashboard";

/**
 * Pastilla de variación. Nunca depende solo del color: lleva flecha y signo.
 * Verde si es buena noticia, rojiza si es mala (para egresos, subir es malo).
 */
export function Delta({
  metric,
  value,
  kind = "pct",
  onDark = false,
}: {
  metric: DeltaMetric;
  value: number | null;
  kind?: "pct" | "points";
  onDark?: boolean;
}) {
  const tone = deltaTone(metric, value);
  const text = kind === "points" ? formatPoints(value) : formatPctChange(value);
  const arrow = value === null || tone === "neutral" ? "•" : value > 0 ? "▲" : "▼";
  const palette = onDark
    ? "bg-white/15 text-white"
    : tone === "good"
      ? "bg-green-100 text-green-600"
      : tone === "bad"
        ? "bg-red-50 text-danger"
        : "bg-cream text-ink-soft";
  const meaning = tone === "good" ? "mejora" : tone === "bad" ? "empeora" : "sin cambio";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${palette}`}
      title={`Frente al período anterior: ${text} (${meaning})`}
    >
      <span aria-hidden className="text-[9px]">{arrow}</span>
      {text}
      <span className="sr-only"> frente al período anterior, {meaning}</span>
    </span>
  );
}
