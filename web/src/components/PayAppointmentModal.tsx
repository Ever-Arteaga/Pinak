"use client";

import { useState } from "react";
import { createReceipt, METHOD_LABELS, pad } from "@/lib/receipts";
import { downloadReceipt, shareReceiptWhatsApp } from "@/lib/receiptPdf";
import { MoneyInput } from "@/components/MoneyInput";
import { MAX_AMOUNT } from "@/lib/money";
import type { Appointment, Business, PaymentMethod, Receipt } from "@/types/pinak";

/** Cobra una cita: crea el recibo, registra el ingreso (o el fiado) y marca la cita como atendida. */
export function PayAppointmentModal({
  business,
  appointment,
  onClose,
}: {
  business: Business;
  appointment: Appointment;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(String(appointment.price));
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Receipt | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function pay() {
    setError(null);
    const value = Number(price);
    if (!value || value <= 0) return setError("Escribe el valor a cobrar.");
    if (value > MAX_AMOUNT) return setError("El valor es demasiado alto.");
    setBusy(true);
    try {
      const r = await createReceipt(business.id, {
        customerId: appointment.customerId,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        items: [{ name: appointment.serviceName, qty: 1, price: value }],
        method,
        status: pending ? "pendiente" : "pagado",
        notes: appointment.notes,
        onlyServices: true,
        appointmentId: appointment.id,
      });
      setCreated(r);
    } catch (e) {
      console.error("Error al cobrar la cita:", e);
      setError("No se pudo registrar el cobro. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function share(r: Receipt) {
    setNote(null);
    const res = await shareReceiptWhatsApp(business, r);
    if (res === "descargado") setNote("Descargamos el PDF y abrimos WhatsApp. Adjunta el archivo en el chat.");
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
        <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 text-center sm:rounded-2xl">
          <p className="text-4xl" aria-hidden>✅</p>
          <h2 className="font-display mt-2 text-lg font-semibold text-navy-900">Cita cobrada · Recibo No. {pad(created.number)}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {created.status === "pagado" ? "Ya quedó registrado como ingreso." : "Quedó registrado como fiado del cliente."}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={() => void share(created)} className="rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">Enviar recibo por WhatsApp (PDF)</button>
            <button onClick={() => downloadReceipt(business, created)} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-cream">Descargar PDF</button>
            <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-cream">Cerrar</button>
          </div>
          {note && <p className="mt-3 text-xs text-ink-soft">{note}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">Cobrar cita</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">✕</button>
        </div>
        <p className="text-sm text-ink"><strong>{appointment.customerName}</strong> · {appointment.serviceName}</p>
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium text-ink">Valor a cobrar</p>
          <MoneyInput value={price} onChange={setPrice} />
        </div>
        <label className="mt-3 block text-sm font-medium text-ink">Medio de pago
          <select className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (<option key={m} value={m}>{METHOD_LABELS[m]}</option>))}
          </select>
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
          Todavía no pagó (dejarlo como fiado)
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
        <button onClick={() => void pay()} disabled={busy} className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-60">
          {busy ? "Registrando..." : pending ? "Registrar como fiado" : "Cobrar y crear recibo"}
        </button>
      </div>
    </div>
  );
}
