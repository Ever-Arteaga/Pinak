"use client";

import { useState } from "react";
import { addAppointment, cancelAppointment, updateAppointment, useAppointments } from "@/lib/appointments";
import { addCustomer, useCustomers } from "@/lib/customers";
import { useProducts } from "@/lib/products";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MoneyInput } from "@/components/MoneyInput";
import { MAX_AMOUNT } from "@/lib/money";
import type { Appointment } from "@/types/pinak";

const INPUT =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500";
const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toTimeInput(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function parseStart(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function AppointmentModal({
  businessId,
  editing,
  initialStart,
  onClose,
}: {
  businessId: string;
  editing?: Appointment;
  /** Fecha y hora con la que arranca una cita nueva (al tocar el calendario). */
  initialStart?: Date;
  onClose: () => void;
}) {
  const { items: customers } = useCustomers(businessId);
  const { items: products } = useProducts(businessId);
  const { items: existing } = useAppointments(businessId);
  const services = products.filter((p) => p.kind === "servicio");

  const base = editing?.start ?? initialStart ?? new Date(Date.now() + 3600000);
  const [name, setName] = useState(editing?.customerName ?? "");
  const [phone, setPhone] = useState(editing?.customerPhone ?? "");
  const [customerId, setCustomerId] = useState<string | undefined>(editing?.customerId);
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [service, setService] = useState(editing?.serviceName ?? "");
  const [price, setPrice] = useState(editing ? String(editing.price) : "");
  const [date, setDate] = useState(toDateInput(base));
  const [time, setTime] = useState(toTimeInput(base));
  const [duration, setDuration] = useState(String(editing?.durationMin ?? 60));
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  /** Otra cita agendada que se cruza con el horario elegido (las canceladas no cuentan). */
  const conflict = (() => {
    const start = parseStart(date, time);
    const dur = Number(duration);
    if (!start || !dur) return null;
    const s = start.getTime();
    const e = s + dur * 60000;
    return (
      existing.find(
        (a) => a.id !== editing?.id && a.status !== "cancelada" && s < a.start.getTime() + a.durationMin * 60000 && e > a.start.getTime()
      ) ?? null
    );
  })();
  const conflictText = conflict
    ? `Ese horario ya está ocupado: ${conflict.customerName} de ${conflict.start.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })} a ${new Date(conflict.start.getTime() + conflict.durationMin * 60000).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}. Elige otra hora.`
    : null;

  function onName(v: string) {
    setName(v);
    const c = customers.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
    if (c) {
      setCustomerId(c.id);
      setPhone(c.phone ?? "");
    } else {
      setCustomerId(undefined);
    }
  }

  function onService(v: string) {
    setService(v);
    const s = services.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
    if (s && !price) setPrice(String(s.price));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Escribe el nombre del cliente.");
    if (!service.trim()) return setError("Escribe qué servicio es la cita.");
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && (digits.length < 7 || digits.length > 15)) return setError("El número de WhatsApp no parece válido.");
    const value = Number(price || "0");
    if (Number.isNaN(value) || value < 0 || value > MAX_AMOUNT) return setError("Revisa el precio.");
    const start = parseStart(date, time);
    if (!start) return setError("La fecha u hora no es válida.");
    if (conflictText) return setError(conflictText);

    setBusy(true);
    try {
      let cid = customerId;
      if (!editing && !cid && saveCustomer) {
        try {
          cid = await addCustomer(businessId, { name, phone });
        } catch {
          cid = undefined;
        }
      }
      const data = { customerId: cid, customerName: name, customerPhone: phone, serviceName: service, price: value, start, durationMin: Number(duration), notes };
      if (editing) await updateAppointment(businessId, editing.id, data);
      else await addAppointment(businessId, data);
      onClose();
    } catch {
      setError("No se pudo guardar la cita. Intenta de nuevo.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!editing) return;
    setBusy(true);
    try {
      await cancelAppointment(businessId, editing.id);
      onClose();
    } catch {
      setError("No se pudo cancelar la cita.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">{editing ? "Editar cita" : "Nueva cita"}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={save} noValidate className="flex flex-col gap-3">
          <label className="text-sm font-medium text-ink">Cliente
            <input className={`${INPUT} mt-1`} list="citas-clientes" maxLength={80} value={name} onChange={(e) => onName(e.target.value)} placeholder="Elige uno guardado o escribe un nombre nuevo" />
            <datalist id="citas-clientes">{customers.map((c) => (<option key={c.id} value={c.name} />))}</datalist>
          </label>
          <input className={INPUT} type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp (para el recordatorio)" aria-label="WhatsApp" />
          {!editing && !customerId && name.trim().length >= 2 && (
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={saveCustomer} onChange={(e) => setSaveCustomer(e.target.checked)} />
              Guardar este cliente para la próxima vez
            </label>
          )}
          <label className="text-sm font-medium text-ink">Servicio
            <input className={`${INPUT} mt-1`} list="citas-servicios" maxLength={80} value={service} onChange={(e) => onService(e.target.value)} placeholder="Ej. Corte de cabello" />
            <datalist id="citas-servicios">{services.map((s) => (<option key={s.id} value={s.name} />))}</datalist>
          </label>
          <div>
            <p className="mb-1 text-sm font-medium text-ink">Precio</p>
            <MoneyInput value={price} onChange={setPrice} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium text-ink">Fecha
              <input className={`${INPUT} mt-1`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-ink">Hora
              <input className={`${INPUT} mt-1`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <label className="text-sm font-medium text-ink">Duración
            <select className={`${INPUT} mt-1`} value={duration} onChange={(e) => setDuration(e.target.value)}>
              {DURATIONS.map((d) => (<option key={d} value={d}>{d >= 60 ? `${d / 60} h` : `${d} min`}</option>))}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">Notas (opcional)
            <textarea className={`${INPUT} mt-1`} rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {conflictText && !error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{conflictText}</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy || !!conflictText} className="mt-1 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60">
            {busy ? "Guardando..." : editing ? "Guardar cambios" : "Agendar cita"}
          </button>
          {editing && (
            <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-red-50 disabled:opacity-60">
              Cancelar cita
            </button>
          )}
        </form>
      </div>
      {confirming && (
        <ConfirmDialog
          title="¿Cancelar esta cita?"
          message="Quedará en el historial como cancelada."
          confirmLabel="Cancelar cita"
          cancelLabel="Volver"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={cancel}
        />
      )}
    </div>
  );
}
