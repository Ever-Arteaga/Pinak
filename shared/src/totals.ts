import type { Transaction } from "./types";

/** Suma de ingresos, egresos y balance de una lista de movimientos. */
export function computeBalance(transactions: Pick<Transaction, "type" | "amount">[]) {
  return transactions.reduce(
    (acc, t) => {
      if (t.type === "ingreso") {
        acc.totalIngresos += t.amount;
        acc.balance += t.amount;
      } else {
        acc.totalEgresos += t.amount;
        acc.balance -= t.amount;
      }
      return acc;
    },
    { balance: 0, totalIngresos: 0, totalEgresos: 0 }
  );
}

/** Formato de pesos colombianos sin decimales: 50000 → "$ 50.000". */
export const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Fecha corta de Colombia: 16/10/2026. */
export const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
