"use client";

import { useState } from "react";
import { addCustomer, deleteCustomer, updateCustomer } from "@/lib/customers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Customer } from "@/types/pinak";

const INPUT =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500";

export function CustomerModal({
  businessId,
  editing,
  onClose,
}: {
  businessId: string;
  editing?: Customer;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [document, setDocument] = useState(editing?.document ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Escribe el nombre del cliente.");
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && (digits.length < 7 || digits.length > 15)) return setError("El número de WhatsApp no parece válido.");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("El correo no parece válido.");
    setBusy(true);
    try {
      const data = { name, phone, email, document, address, notes };
      if (editing) await updateCustomer(businessId, editing.id, data);
      else await addCustomer(businessId, data);
      onClose();
    } catch {
      setError("No se pudo guardar el cliente. Intenta de nuevo.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteCustomer(businessId, editing.id);
      onClose();
    } catch {
      setError("No se pudo eliminar el cliente.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">{editing ? "Editar cliente" : "Nuevo cliente"}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={save} noValidate className="flex flex-col gap-3">
          <label className="text-sm font-medium text-ink">Nombre
            <input className={`${INPUT} mt-1`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María Rodríguez" />
          </label>
          <label className="text-sm font-medium text-ink">WhatsApp (opcional)
            <input className={`${INPUT} mt-1`} type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 3001234567" />
          </label>
          <label className="text-sm font-medium text-ink">Correo (opcional)
            <input className={`${INPUT} mt-1`} type="email" maxLength={80} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-ink">Cédula o NIT (opcional)
            <input className={`${INPUT} mt-1`} maxLength={30} value={document} onChange={(e) => setDocument(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-ink">Dirección (opcional)
            <input className={`${INPUT} mt-1`} maxLength={120} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="text-sm font-medium text-ink">Notas (opcional)
            <textarea className={`${INPUT} mt-1`} rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="mt-1 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60">
            {busy ? "Guardando..." : editing ? "Guardar cambios" : "Guardar cliente"}
          </button>
          {editing && (
            <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-60">
              Eliminar cliente
            </button>
          )}
        </form>
      </div>
      {confirming && (
        <ConfirmDialog
          title="¿Eliminar este cliente?"
          message="Los recibos que ya le hiciste no se borran."
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
