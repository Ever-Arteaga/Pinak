"use client";

import { useState } from "react";
import { usePrivacy } from "@/lib/privacy";
import {
  buildWhatsAppCollectionLink,
  markReceivableAsPaid,
  useReceivables,
} from "@/lib/receivables";
import { AddReceivableModal } from "@/components/AddReceivableModal";
import { AppHeader } from "@/components/AppHeader";
import { useBusiness } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import type { Receivable } from "@/types/pinak";

export default function ReceivablesPage() {
  const { business } = useBusiness();
  const { money } = usePrivacy();
  const { receivables, loading } = useReceivables(business?.id);
  const [showModal, setShowModal] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  const pendientes = receivables.filter((r) => r.status !== "pagado");
  const totalPendiente = pendientes.reduce((sum, r) => sum + r.amount, 0);

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Fiados" />

      <div className="mx-auto max-w-md px-5 pt-6">
        <section className="rounded-2xl bg-navy-900 p-6 text-white shadow-sm">
          <p className="text-sm text-white/70">Total por cobrar</p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {money(totalPendiente)}
          </p>
          <p className="mt-2 text-xs text-white/60">
            {pendientes.length} {pendientes.length === 1 ? "fiado pendiente" : "fiados pendientes"}
          </p>
        </section>

        <button
          onClick={() => setShowModal(true)}
          className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
        >
          + Nuevo fiado
        </button>

        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Cuentas por cobrar
          </h2>

          <div className="mt-3 flex flex-col gap-3">
            {loading && (
              <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft">
                Cargando fiados...
              </p>
            )}

            {!loading && receivables.length === 0 && (
              <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center">
                <p className="text-sm font-medium text-ink">Sin fiados registrados</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Cuando un cliente te deba, regístralo aquí y cóbralo por WhatsApp en 1 clic.
                </p>
              </div>
            )}

            {receivables.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-line bg-white p-4 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setEditingReceivable(r)}
                  className="flex w-full items-start justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.clientName}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {r.status === "pagado" ? "Pagado" : "Pendiente"}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      r.status === "pagado" ? "text-ink-soft line-through" : "text-navy-900"
                    }`}
                  >
                    {money(r.amount)}
                  </p>
                </button>

                {r.status !== "pagado" && (
                  <div className="mt-3 flex gap-2">
                    <a
                      href={buildWhatsAppCollectionLink(
                        biz.name,
                        r
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      Cobrar por WhatsApp
                    </a>
                    <button
                      onClick={() => markReceivableAsPaid(biz.id, r.id)}
                      className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-green-100"
                    >
                      Marcar pagado
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {showModal && (
        <AddReceivableModal businessId={biz.id} onClose={() => setShowModal(false)} />
      )}

      {editingReceivable && (
        <AddReceivableModal
          businessId={biz.id}
          editingReceivable={editingReceivable}
          onClose={() => setEditingReceivable(null)}
        />
      )}
    </main>
  );
}
