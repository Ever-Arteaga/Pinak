import type { Category, TransactionType } from "./types";

/** Categorías de un tipo (ingreso o egreso). */
export function filterCategoriesByType(categories: Category[], type: TransactionType) {
  return categories.filter((c) => c.type === type);
}
