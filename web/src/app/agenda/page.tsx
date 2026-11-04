"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CalendarView } from "@/components/CalendarView";
import { AppointmentModal } from "@/components/AppointmentModal";
import { PayAppointmentModal } from "@/components/PayAppointmentModal";
import { PremiumLock } from "@/components/PremiumLock";
import { SetupModal } from "@/components/SetupModal";
import { useBusiness } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { usePrivacy } from "@/lib/privacy";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { appointmentReminderLink, deleteAppointment, useAppointments } from "@/lib/appointments";
import { PLAN_LIMITS, type Appointment } from "@/types/pinak";

function dayLabel(d: Date): string {
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (same(d, today)) return "Hoy";
  if (same(d, tomorrow)) return "Mañana";
  const s = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AgendaPage() {
  const { business, isOwner } = useBusiness();
  const { money } = usePrivacy();
  const { items, loading, error, retry } = useAppointments(business?.id);
  const [creating, setCreating] = useState(false);
  const [newStart, setNewStart] = useState<Date | undefined>();
  const [removing, setRemoving] = useState<Appointment | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeErr, setRemoveErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [tab, setTab] = useState<"calendario" | "lista">("calendario");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [paying, setPaying] = useState<Appointment | null>(null);
  const [setup, setSetup] = useState(false);

  const { upcoming, history } = useMemo(() => {
    const open = items.filter((a) => a.status === "agendada");
    const groups = new Map<string, { label: string; list: Appointment[] }>();
    for (const a of open) {
      const key = a.start.toDateString();
      if (!groups.has(key)) groups.set(key, { label: dayLabel(a.start), list: [] });
      groups.get(key)!.list.push(a);
    }
    return {
      upcoming: [...groups.values()],
      history: items.filter((a) => a.status !== "agendada").sort((a, b) => b.start.getTime() - a.start.getTime()).slice(0, 30),
    };
  }, [items]);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;
  if (!PLAN_LIMITS[biz.plan].agenda) {
    return (
      <PremiumLock
        title="Agenda"
        heading="Agenda de citas con cobro"
        text="Programa citas, recuérdalas por WhatsApp y cóbralas con un recibo en PDF. Disponible en el plan Premium."
        icon="📅"
      />
    );
  }

  if (biz.usesAppointments !== true) {
    return (
      <main className="min-h-screen bg-cream pb-24">
        <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Agenda" />
        <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
          <section className="rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-3xl" aria-hidden>📅</p>
            <h1 className="font-display mt-2 text-base font-semibold text-navy-900">Activa tu agenda</h1>
            <p className="mt-2 text-sm text-ink-soft">
              {isOwner
                ? "Cuéntanos si atiendes con citas y la activamos."
                : "El dueño del negocio debe activar la agenda desde su perfil."}
            </p>
            {isOwner && (
              <button onClick={() => setSetup(true)} className="mt-4 rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800">
                Responder cuestionario
              </button>
            )}
          </section>
        </div>
        {setup && <SetupModal business={biz} onClose={() => setSetup(false)} />}
      </main>
    );
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveErr(null);
    try {
      await deleteAppointment(biz.id, removing.id);
      setRemoving(null);
    } catch {
      setRemoveErr("No se pudo eliminar la cita. Intenta de nuevo.");
    } finally {
      setRemoveBusy(false);
    }
  }

  const hora = (d: Date) => d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Agenda" />
      <div className={`mx-auto w-full px-5 pt-6 md:px-8 ${tab === "calendario" ? "max-w-md md:max-w-4xl lg:max-w-6xl" : "max-w-md md:max-w-2xl lg:max-w-4xl"}`}>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-white p-0.5 text-sm font-semibold shadow-sm ring-1 ring-line">
            {(["calendario", "lista"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-navy-900 text-white" : "text-ink-soft"}`}>
                {t === "calendario" ? "Calendario" : "Lista"}
              </button>
            ))}
          </div>
          <button onClick={() => { setNewStart(undefined); setCreating(true); }} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500">
            + Nueva cita
          </button>
        </div>

        {error && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-danger">{error}</p>
            <button onClick={retry} className="mt-3 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
          </div>
        )}
        {tab === "calendario" && !error && (
          <div className="mt-4">
            <CalendarView
              appointments={items}
              onCreate={(d) => { setNewStart(d); setCreating(true); }}
              onOpen={setSelected}
            />
          </div>
        )}
        {tab === "lista" && loading && <p className="mt-5 rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft">Cargando agenda...</p>}
        {tab === "lista" && !loading && !error && upcoming.length === 0 && (
          <div className="mt-5 rounded-2xl border border-line bg-white px-4 py-8 text-center">
            <p className="text-sm font-medium text-ink">No tienes citas por atender</p>
            <p className="mt-1 text-sm text-ink-soft">Agenda una y recuérdasela al cliente por WhatsApp.</p>
          </div>
        )}

        {tab === "lista" && upcoming.map((g) => (
          <section key={g.label + g.list[0].start.toDateString()} className="mt-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">{g.label}</h2>
            <div className="mt-3 flex flex-col gap-3 lg:grid lg:grid-cols-2">
              {g.list.map((a) => {
                const vencida = a.start.getTime() + a.durationMin * 60000 < Date.now();
                return (
                  <div key={a.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                    <button type="button" onClick={() => setEditing(a)} className="flex w-full items-start justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{hora(a.start)} · {a.customerName}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-soft">
                          {a.serviceName} · {a.durationMin >= 60 ? `${a.durationMin / 60} h` : `${a.durationMin} min`}
                          {vencida && <span className="font-semibold text-danger"> · ya pasó la hora</span>}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-navy-900">{money(a.price)}</p>
                    </button>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setPaying(a)} className="flex-1 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-800">
                        Cobrar
                      </button>
                      <a
                        href={appointmentReminderLink(biz.name, a)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                      >
                        Recordar
                      </a>
                      <button onClick={() => setEditing(a)} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream">
                        Editar
                      </button>
                      <button onClick={() => setRemoving(a)} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-danger transition hover:bg-red-50" aria-label="Eliminar cita">
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {tab === "lista" && history.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">Historial</h2>
            <div className="mt-3 flex flex-col gap-2">
              {history.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{a.customerName} · {a.serviceName}</p>
                    <p className="text-xs text-ink-soft">
                      {a.start.toLocaleDateString("es-CO", { day: "numeric", month: "short" })} {hora(a.start)}
                    </p>
                  </div>
                  <button onClick={() => setRemoving(a)} className="ml-3 text-xs font-semibold text-danger hover:underline" aria-label="Eliminar cita">Eliminar</button>
                  <span className={`ml-3 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    a.status === "cancelada" ? "bg-red-50 text-danger" : a.paid ? "bg-green-100 text-navy-900" : "bg-cream text-ink-soft"
                  }`}>
                    {a.status === "cancelada" ? "Cancelada" : a.paid ? "Pagada" : "Atendida · fiado"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {creating && <AppointmentModal businessId={biz.id} initialStart={newStart} onClose={() => setCreating(false)} />}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-base font-semibold text-navy-900">{selected.customerName}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{selected.serviceName} · {money(selected.price)}</p>
            <p className="mt-2 text-sm text-ink">
              {selected.start.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}, {hora(selected.start)}
              {" · "}{selected.durationMin >= 60 ? `${selected.durationMin / 60} h` : `${selected.durationMin} min`}
            </p>
            {selected.notes && <p className="mt-1 text-xs text-ink-soft">{selected.notes}</p>}
            <div className="mt-4 flex flex-col gap-2">
              {selected.status === "agendada" && (
                <>
                  <button onClick={() => { setPaying(selected); setSelected(null); }} className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800">Cobrar</button>
                  <a href={appointmentReminderLink(biz.name, selected)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90">Recordar por WhatsApp</a>
                  <button onClick={() => { setEditing(selected); setSelected(null); }} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-cream">Editar o cancelar</button>
                </>
              )}
              {selected.status !== "agendada" && (
                <p className="rounded-lg bg-cream px-3 py-2 text-sm text-ink-soft">{selected.paid ? "Cita atendida y pagada." : "Cita atendida, quedó como fiado."}</p>
              )}
              <button onClick={() => { setRemoving(selected); setSelected(null); }} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-red-50">Eliminar cita</button>
              <button onClick={() => setSelected(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-cream">Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {editing && <AppointmentModal businessId={biz.id} editing={editing} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title="¿Eliminar esta cita?"
          message={`Se borra la cita de ${removing.customerName}. ${removing.receiptId ? "El recibo con el que se cobró no se borra. " : ""}${removeErr ?? "Esto no se puede deshacer."}`}
          busy={removeBusy}
          onConfirm={() => void confirmRemove()}
          onCancel={() => { setRemoving(null); setRemoveErr(null); }}
        />
      )}
      {paying && <PayAppointmentModal business={biz} appointment={paying} onClose={() => setPaying(null)} />}
    </main>
  );
}
