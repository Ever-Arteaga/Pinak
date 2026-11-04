"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PremiumLock } from "@/components/PremiumLock";
import { PLAN_LIMITS } from "@/types/pinak";
import { NewReceiptModal } from "@/components/NewReceiptModal";
import { useBusiness } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { usePrivacy } from "@/lib/privacy";
import { deleteReceipt, receiptLabel, useReceipts } from "@/lib/receipts";
import { downloadReceipt, printReceipt, shareReceiptWhatsApp } from "@/lib/receiptPdf";
import { markReceivableAsPaid, useReceivables } from "@/lib/receivables";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Receipt } from "@/types/pinak";

export default function RecibosPage() {
  const { business } = useBusiness();
  const { money } = usePrivacy();
  const { items, loading, error, retry } = useReceipts(business?.id);
  const [creating, setCreating] = useState(false);
  const { receivables } = useReceivables(business?.id);
  const [note, setNote] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Receipt | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;
  if (!PLAN_LIMITS[biz.plan].invoicing) return <PremiumLock title="Recibos" />;

  /** Un recibo que quedó en fiado pasa a "pagado" cuando se cobra ese fiado. */
  const paidIds = new Set(receivables.filter((x) => x.status === "pagado").map((x) => x.id));
  const effective = (r: Receipt): Receipt =>
    r.status === "pendiente" && r.docType !== "factura" && r.receivableId && paidIds.has(r.receivableId) ? { ...r, status: "pagado" } : r;
  const isPaid = (r: Receipt) => r.status === "pagado" || (!!r.receivableId && paidIds.has(r.receivableId));

  async function markPaid(r: Receipt) {
    if (!r.receivableId) return;
    setBusyId(r.id);
    setNote(null);
    try {
      await markReceivableAsPaid(biz.id, r.receivableId);
      setNote("Listo, quedó marcado como pagado.");
    } catch {
      setNote("No se pudo marcar como pagado. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deleteReceipt(biz.id, deleting);
      setNote("Recibo eliminado.");
    } catch {
      setNote("No se pudo eliminar. Intenta de nuevo.");
    } finally {
      setBusyId(null);
      setDeleting(null);
    }
  }

  async function send(r: Receipt) {
    setNote(null);
    const res = await shareReceiptWhatsApp(biz, effective(r));
    if (res === "descargado") setNote("Descargamos el PDF y abrimos WhatsApp. Adjunta el archivo en el chat.");
  }

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Recibos" />
      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
        <button onClick={() => setCreating(true)} className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-500">
          + Nuevo recibo
        </button>
        <p className="mt-3 text-xs text-ink-soft">
          Los recibos son comprobantes internos. Las facturas usan tu numeración autorizada, pero no son factura electrónica: valida con tu contador.
        </p>
        {note && <p className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-sm text-navy-900">{note}</p>}

        <div className="mt-5 flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {error && (
            <div className="px-4 py-6 text-center lg:col-span-2">
              <p className="text-sm text-danger">{error}</p>
              <button onClick={retry} className="mt-3 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
            </div>
          )}
          {loading && <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft lg:col-span-2">Cargando recibos...</p>}
          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center lg:col-span-2">
              <p className="text-sm font-medium text-ink">Aún no has hecho recibos</p>
              <p className="mt-1 text-sm text-ink-soft">Crea uno, se registra la venta y lo envías por WhatsApp en PDF.</p>
            </div>
          )}
          {items.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{receiptLabel(r)} · {r.customerName}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {r.date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    <span className={isPaid(r) ? "" : "font-semibold text-danger"}>
                      {isPaid(r) ? "Pagado" : "Pendiente"}
                    </span>
                  </p>
                </div>
                <p className="text-sm font-semibold text-navy-900">{money(r.total)}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => void send(r)} className="flex-1 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90">
                  Enviar por WhatsApp
                </button>
                <button onClick={() => printReceipt(biz, effective(r))} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-green-100">
                  Imprimir
                </button>
                <button onClick={() => downloadReceipt(biz, effective(r))} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-green-100">
                  PDF
                </button>
              </div>
              {(!isPaid(r) && r.receivableId) || r.docType !== "factura" ? (
                <div className="mt-2 flex gap-2">
                  {!isPaid(r) && r.receivableId && (
                    <button onClick={() => void markPaid(r)} disabled={busyId === r.id} className="flex-1 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60">
                      Marcar como pagado
                    </button>
                  )}
                  {r.docType !== "factura" && (
                    <button onClick={() => setDeleting(r)} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-danger transition hover:bg-red-50">
                      Eliminar
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {deleting && (
        <ConfirmDialog
          title="¿Eliminar este recibo?"
          message={`Se borra el recibo ${receiptLabel(deleting)} y también el ${deleting.status === "pendiente" ? "fiado" : "ingreso"} que registró. Esto no se puede deshacer.`}
          busy={busyId === deleting.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
      {creating && <NewReceiptModal business={biz} onClose={() => setCreating(false)} />}
    </main>
  );
}
