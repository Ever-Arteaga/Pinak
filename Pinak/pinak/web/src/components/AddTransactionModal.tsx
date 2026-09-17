"use client";

import { useState } from "react";
import { addTransaction, deleteTransaction, updateTransaction } from "@/lib/transactions";
import { addCategory, useCategories } from "@/lib/categories";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { PaymentMethod, Transaction, TransactionType } from "@/types/pinak";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

export function AddTransactionModal({
  userId,
  editingTransaction,
  onClose,
}: {
  userId: string;
  editingTransaction?: Transaction;
  onClose: () => void;
}) {
  const isEditing = Boolean(editingTransaction);

  const [type, setType] = useState<TransactionType>(editingTransaction?.type ?? "ingreso");
  const [amount, setAmount] = useState(editingTransaction ? String(editingTransaction.amount) : "");
  const [category, setCategory] = useState(editingTransaction?.category ?? "");
  const [method, setMethod] = useState<PaymentMethod>(editingTransaction?.method ?? "efectivo");
  const [description, setDescription] = useState(editingTransaction?.description ?? "");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { categories } = useCategories(userId);
  const categoriesForType = categories.filter((c) => c.type === type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    const finalCategory = addingCustom ? customCategory.trim() : category;
    if (!finalCategory) return;

    setSaving(true);
    setError(null);
    try {
      const alreadyExists = categoriesForType.some(
        (c) => c.name.toLowerCase() === finalCategory.toLowerCase()
      );
      if (addingCustom && !alreadyExists) {
        await addCategory(userId, finalCategory, type);
      }

      const payload = {
        type,
        amount: numericAmount,
        category: finalCategory,
        method,
        description,
      };
      if (isEditing && editingTransaction) {
        await updateTransaction(userId, editingTransaction.id, payload);
      } else {
        await addTransaction(userId, payload);
      }
      onClose();
    } catch (err) {
      console.error("Error al guardar transacción:", err);
      setError(
        err instanceof Error
          ? traducirErrorFirestore(err.message)
          : "No se pudo guardar el registro."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingTransaction) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTransaction(userId, editingTransaction.id);
      onClose();
    } catch (err) {
      console.error("Error al eliminar transacción:", err);
      setError(
        err instanceof Error
          ? traducirErrorFirestore(err.message)
          : "No se pudo eliminar el registro."
      );
    } finally {
      setDeleting(false);
    }
  }

  const busy = saving || deleting;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">
            {isEditing ? "Editar registro" : "Nuevo registro"}
          </h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="mb-4 flex rounded-lg border border-line p-1">
          <button
            type="button"
            onClick={() => {
              setType("ingreso");
              setCategory("");
              setAddingCustom(false);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              type === "ingreso" ? "bg-green-100 text-green-600" : "text-ink-soft"
            }`}
          >
            Ingreso
          </button>
          <button
            type="button"
            onClick={() => {
              setType("egreso");
              setCategory("");
              setAddingCustom(false);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              type === "egreso" ? "bg-red-50 text-danger" : "text-ink-soft"
            }`}
          >
            Egreso
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Monto</label>
            <input
              type="number"
              inputMode="decimal"
              required
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="$0"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {categoriesForType.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCategory(c.name);
                    setAddingCustom(false);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    category === c.name && !addingCustom
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-line text-ink hover:bg-cream"
                  }`}
                >
                  {c.icon} {c.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAddingCustom(true);
                  setCategory("");
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  addingCustom
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-dashed border-line text-ink-soft hover:bg-cream"
                }`}
              >
                + Otra
              </button>
            </div>
            {addingCustom && (
              <input
                type="text"
                autoFocus
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Nombre de la categoría"
                className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Método</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle del movimiento"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar registro"}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-60"
            >
              Eliminar registro
            </button>
          )}
        </form>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="¿Eliminar este registro?"
          message="Esta acción no se puede deshacer. El movimiento se borrará de tu historial."
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function traducirErrorFirestore(message: string): string {
  if (message.includes("permission-denied"))
    return "No tienes permiso para guardar (revisa las reglas de Firestore).";
  if (message.includes("unauthenticated"))
    return "Tu sesión expiró, vuelve a iniciar sesión.";
  if (message.includes("unavailable"))
    return "Sin conexión con el servidor. Intenta de nuevo.";
  return "No se pudo guardar el registro. Intenta de nuevo.";
}
