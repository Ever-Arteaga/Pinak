"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NewQuoteModal } from "@/components/NewQuoteModal";
import { NewReceiptModal } from "@/components/NewReceiptModal";
import { PremiumLock } from "@/components/PremiumLock";
import { useBusiness } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { usePrivacy } from "@/lib/privacy";
import { deleteQuote, QUOTE_STATUS_LABELS, quoteNumber, setQuoteStatus, useQuotes } from "@/lib/quotes";
import { downloadQuote, printQuote, shareQuoteWhatsApp } from "@/lib/quotePdf";
import { PLAN_LIMITS, type Quote } from "@/types/pinak";

export default function CotizacionesPage() {
  const { business } = useBusiness();
  const { money } = usePrivacy();
  const { items, loading, error, retry } = useQuotes(business?.id);
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;
  if (!PLAN_LIMITS[biz.plan].invoicing) {
    return (
      <PremiumLock
        title="Cotizaciones"
        heading="Cotizaciones para tus clientes"
        text="Crea cotizaciones numeradas, envíalas por WhatsApp en PDF y conviértelas en recibo cuando el cliente acepte. Disponible en el plan Premium."
        icon="📄"
      />
    );
  }

  async function send(q: Quote) {
    setNote(null);
    const res = await shareQuoteWhatsApp(biz, q);
    if (res === "descargado") setNote("Descargamos el PDF y abrimos WhatsApp. Adjunta el archivo en el chat.");
  }

  async function changeStatus(q: Quote, status: "pendiente" | "aceptada" | "rechazada") {
    setBusyId(q.id);
    setNote(null);
    try {
      await setQuoteStatus(biz.id, q.id, status);
    } catch {
      setNote("No se pudo cambiar el estado. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deleteQuote(biz.id, deleting.id);
      setNote("Cotización eliminada.");
    } catch {
      setNote("No se pudo eliminar. Intenta de nuevo.");
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  }

  const now = Date.now();

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Cotizaciones" />
      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
        <button onClick={() => setCreating(true)} className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-500">
          + Nueva cotización
        </button>
        <p className="mt-3 text-xs text-ink-soft">
          Una cotización es una propuesta de precios: no registra ventas ni ingresos. Cuando el cliente acepte, conviértela en recibo.
        </p>
        {note && <p className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-sm text-navy-900">{note}</p>}

        <div className="mt-5 flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {error && (
            <div className="px-4 py-6 text-center lg:col-span-2">
              <p className="text-sm text-danger">{error}</p>
              <button onClick={retry} className="mt-3 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
            </div>
          )}
          {loading && <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft lg:col-span-2">Cargando cotizaciones...</p>}
          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center lg:col-span-2">
              <p className="text-sm font-medium text-ink">Aún no has hecho cotizaciones</p>
              <p className="mt-1 text-sm text-ink-soft">Crea una y envíala al cliente por WhatsApp en PDF.</p>
            </div>
          )}
          {items.map((q) => {
            const expired = q.status === "pendiente" && q.validUntil.getTime() < now;
            const converted = !!q.receiptId;
            return (
              <div key={q.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{quoteNumber(q)} · {q.customerName}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {q.date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      {" · válida hasta "}
                      {q.validUntil.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        converted
                          ? "bg-green-100 text-navy-900"
                          : q.status === "aceptada"
                          ? "bg-green-100 text-navy-900"
                          : q.status === "rechazada" || expired
                          ? "bg-red-50 text-danger"
                          : "bg-cream text-ink-soft"
                      }`}
                    >
                      {converted ? "Convertida en recibo" : expired ? "Vencida" : QUOTE_STATUS_LABELS[q.status]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-navy-900">{money(q.total)}</p>
                </div>

                <div className="mt-3 flex gap-2">
                  <button onClick={() => void send(q)} className="flex-1 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90">
                    Enviar por WhatsApp
                  </button>
                  <button onClick={() => printQuote(biz, q)} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-green-100">
                    Imprimir
                  </button>
                  <button onClick={() => downloadQuote(biz, q)} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-green-100">
                    PDF
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {!converted && q.status !== "rechazada" && (
                    <button onClick={() => setConverting(q)} className="flex-1 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-800">
                      Convertir en recibo
                    </button>
                  )}
                  {!converted && q.status === "pendiente" && (
                    <>
                      <button onClick={() => void changeStatus(q, "aceptada")} disabled={busyId === q.id} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-green-100 disabled:opacity-60">
                        Aceptada
                      </button>
                      <button onClick={() => void changeStatus(q, "rechazada")} disabled={busyId === q.id} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-cream disabled:opacity-60">
                        Rechazada
                      </button>
                    </>
                  )}
                  {!converted && q.status !== "pendiente" && (
                    <button onClick={() => void changeStatus(q, "pendiente")} disabled={busyId === q.id} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-cream disabled:opacity-60">
                      Volver a pendiente
                    </button>
                  )}
                  <button onClick={() => setDeleting(q)} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-danger transition hover:bg-red-50">
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {creating && <NewQuoteModal business={biz} onClose={() => setCreating(false)} />}
      {converting && (
        <NewReceiptModal
          business={biz}
          prefill={{
            customerId: converting.customerId,
            name: converting.customerName === "Cliente general" ? "" : converting.customerName,
            phone: converting.customerPhone,
            document: converting.customerDocument,
            items: converting.items,
          }}
          onCreated={(r) => {
            // La cotización queda aceptada y enlazada con el recibo.
            void setQuoteStatus(biz.id, converting.id, "aceptada", r.id).catch(() => undefined);
          }}
          onClose={() => setConverting(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="¿Eliminar esta cotización?"
          message={`Se borra la cotización ${quoteNumber(deleting)}. Esto no se puede deshacer.`}
          busy={busyId === deleting.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  );
}
