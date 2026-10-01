"use client";

export interface BarChartDatum {
  label: string;
  ingreso: number;
  egreso: number;
}

export function BarChart({
  data,
  formatValue,
}: {
  data: BarChartDatum[];
  formatValue?: (valor: number) => string;
}) {
  const format = formatValue ?? ((v: number) => v.toLocaleString("es-CO"));
  const maximo = Math.max(1, ...data.flatMap((d) => [d.ingreso, d.egreso]));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-soft">
        No hay datos suficientes para la gráfica.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-600" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-danger/70" /> Egresos
        </span>
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto" style={{ height: 150 }}>
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className="flex min-w-[32px] flex-1 flex-col items-center"
          >
            <div className="flex flex-1 items-end gap-1">
              <div
                className="w-3 rounded-t bg-green-600 transition-all"
                style={{ height: `${(d.ingreso / maximo) * 100}%` }}
                title={`Ingresos: ${format(d.ingreso)}`}
              />
              <div
                className="w-3 rounded-t bg-danger/70 transition-all"
                style={{ height: `${(d.egreso / maximo) * 100}%` }}
                title={`Egresos: ${format(d.egreso)}`}
              />
            </div>
            <span className="mt-1.5 whitespace-nowrap text-[10px] text-ink-soft">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
