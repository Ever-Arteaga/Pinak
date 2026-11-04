"use client";

import { useState } from "react";
import { addProduct, deleteProduct, updateProduct } from "@/lib/products";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MoneyInput } from "@/components/MoneyInput";
import { MAX_AMOUNT } from "@/lib/money";
import type { Product, ProductKind } from "@/types/pinak";

export function ProductModal({
  businessId,
  editing,
  onClose,
}: {
  businessId: string;
  editing?: Product;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState(editing ? String(editing.price) : "");
  const [kind, setKind] = useState<ProductKind>(editing?.kind ?? "producto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(price);
    if (!name.trim()) return setError("Escribe el nombre del producto o servicio.");
    if (!price || Number.isNaN(value) || value < 0) return setError("Escribe un precio válido.");
    if (value > MAX_AMOUNT) return setError("El precio es demasiado alto. Revisa que no tenga ceros de más.");
    setBusy(true);
    try {
      if (editing) await updateProduct(businessId, editing.id, { name, price: value, kind });
      else await addProduct(businessId, { name, price: value, kind });
      onClose();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteProduct(businessId, editing.id);
      onClose();
    } catch {
      setError("No se pudo eliminar.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">{editing ? "Editar del catálogo" : "Nuevo en el catálogo"}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={save} noValidate className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
            {(["producto", "servicio"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${kind === k ? "border-green-500 bg-green-100 text-navy-900" : "border-line text-ink-soft hover:bg-cream"}`}
              >
                {k === "producto" ? "Producto" : "Servicio"}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium text-ink">Nombre
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "servicio" ? "Ej. Corte de cabello" : "Ej. Almuerzo ejecutivo"}
            />
          </label>
          <div>
            <p className="mb-1 text-sm font-medium text-ink">Precio</p>
            <MoneyInput value={price} onChange={setPrice} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="mt-1 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60">
            {busy ? "Guardando..." : editing ? "Guardar cambios" : "Guardar"}
          </button>
          {editing && (
            <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-60">
              Eliminar
            </button>
          )}
        </form>
      </div>
      {confirming && (
        <ConfirmDialog
          title="¿Quitar del catálogo?"
          message="Los recibos anteriores no cambian."
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
