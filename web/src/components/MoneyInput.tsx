"use client";

import { digitsOnly, formatThousands } from "@/lib/money";

/** Campo de monto en pesos con separador de miles mientras se escribe ($ 50.000). */
export function MoneyInput({
  value,
  onChange,
  className = "",
  id,
}: {
  /** Solo dígitos, p. ej. "50000". */
  value: string;
  onChange: (digits: string) => void;
  className?: string;
  id?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">$</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatThousands(value)}
        onChange={(e) => onChange(digitsOnly(e.target.value))}
        placeholder="0"
        className={`w-full rounded-lg border border-line py-2 pl-7 pr-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 ${className}`}
      />
    </div>
  );
}
