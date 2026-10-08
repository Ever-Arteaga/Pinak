"use client";

import { useState } from "react";
import { addReceivable, deleteReceivable, updateReceivable } from "@/lib/receivables";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Receivable } from "@/types/pinak";

export function AddReceivableModal({
  businessId,
  editingReceivable,
  onClose,
}: {
  businessId: string;
  editingReceivable?: Receivable;
  onClose: () => void;
}) {
  const isEditing = Boolean(editingReceivable);

  const [clientName, setClientName] = useState(editingReceivable?.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(editingReceivable?.clientPhone ?? "");
  const [amount, setAmount] = useState(
    editingReceivable ? String(editingReceivable.amount) : ""
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!clientName || !numericAmount || numericAmount <= 0) return;

    setSaving(true);
    setError(null);
    try {
      const payload = { clientName, clientPhone, amount: numericAmount };
      if (isEditing && editingReceivable) {
        await updateReceivable(businessId, editingReceivable.id, payload);
      } else {
        await addReceivable(businessId, payload);
      }
      onClose();
    } catch (err) {
      console.error("Error al guardar fiado:", err);
      setError(
        err instanceof Error ? traducirErrorFirestore(err.message) : "No se pudo guardar el fiado."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingReceivable) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReceivable(businessId, editingReceivable.id);
      onClose();
    } catch (err) {
      console.error("Error al eliminar fiado:", err);
      setError(
        err instanceof Error ? traducirErrorFirestore(err.message) : "No se pudo eliminar el fiado."
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
            {isEditing ? "Editar fiado" : "Nuevo fiado"}
          </h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Nombre del cliente
            </label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej. María Rodríguez"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              WhatsApp del cliente (opcional)
            </label>
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ej. 3001234567"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <p className="mt-1 text-xs text-ink-soft">
              Sin este dato, igual podrás enviar el cobro eligiendo el contacto manualmente en WhatsApp.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Monto adeudado</label>
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

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar fiado"}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-60"
            >
              Eliminar fiado
            </button>
          )}
        </form>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="¿Eliminar este fiado?"
          message="Esta acción no se puede deshacer."
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
  return "No se pudo guardar el fiado. Intenta de nuevo.";
}
