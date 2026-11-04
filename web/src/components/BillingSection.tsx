"use client";

import { useState } from "react";
import { updateBusinessBilling } from "@/lib/business";
import { billingProblems, TAX_STATUS_LABELS, type BillingConfig, type TaxStatus } from "@pinak/shared/billing";
import type { Business } from "@/types/pinak";

const INPUT =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500";

const EMPTY: BillingConfig = {
  mode: "recibo",
  taxStatus: "no_responsable",
  taxNote: "",
  resolutionNumber: "",
  resolutionDate: "",
  prefix: "",
  rangeFrom: 1,
  rangeTo: 1000,
  validUntil: "",
};

/** Datos de la autorización de numeración que se imprimen en las facturas. Solo dueño, plan Premium. */
export function BillingSection({ business }: { business: Business }) {
  const [b, setB] = useState<BillingConfig>(business.billing ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (p: Partial<BillingConfig>) => setB((prev) => ({ ...prev, ...p }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const problems = b.mode === "factura" ? billingProblems(b, null) : [];
    if (problems.length) return setMsg(problems[0]);
    setBusy(true);
    try {
      await updateBusinessBilling(business.id, { ...b, prefix: b.prefix.trim().toUpperCase() });
      setMsg("Datos guardados.");
    } catch (err) {
      console.error(err);
      setMsg("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-base font-semibold text-navy-900">Datos de facturación</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Para imprimir facturas numeradas con la autorización de la DIAN. Tu negocio debe tener su propia autorización de numeración
        vigente. Pinak no es proveedor tecnológico de factura electrónica: pide a tu contador que valide si debes facturar
        electrónicamente.
      </p>
      <form onSubmit={save} noValidate className="mt-4 grid grid-cols-2 gap-3">
        <label className="col-span-2 text-sm font-medium text-ink">Documento por defecto
          <select className={`${INPUT} mt-1`} value={b.mode} onChange={(e) => set({ mode: e.target.value as BillingConfig["mode"] })}>
            <option value="recibo">Recibo interno</option>
            <option value="factura">Factura con numeración DIAN</option>
          </select>
        </label>
        <label className="col-span-2 text-sm font-medium text-ink">Responsabilidad tributaria
          <select className={`${INPUT} mt-1`} value={b.taxStatus} onChange={(e) => set({ taxStatus: e.target.value as TaxStatus })}>
            {(Object.keys(TAX_STATUS_LABELS) as TaxStatus[]).map((k) => (<option key={k} value={k}>{TAX_STATUS_LABELS[k]}</option>))}
          </select>
        </label>
        <label className="col-span-2 text-sm font-medium text-ink">Nota tributaria (opcional)
          <input className={`${INPUT} mt-1`} maxLength={120} value={b.taxNote} onChange={(e) => set({ taxNote: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-ink">Nº de resolución
          <input className={`${INPUT} mt-1`} maxLength={30} value={b.resolutionNumber} onChange={(e) => set({ resolutionNumber: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-ink">Fecha resolución
          <input className={`${INPUT} mt-1`} type="date" value={b.resolutionDate} onChange={(e) => set({ resolutionDate: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-ink">Prefijo (máx. 4)
          <input className={`${INPUT} mt-1`} maxLength={4} value={b.prefix} onChange={(e) => set({ prefix: e.target.value.toUpperCase() })} />
        </label>
        <label className="text-sm font-medium text-ink">Vigente hasta
          <input className={`${INPUT} mt-1`} type="date" value={b.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-ink">Rango desde
          <input className={`${INPUT} mt-1`} inputMode="numeric" value={b.rangeFrom} onChange={(e) => set({ rangeFrom: Math.floor(Number(e.target.value.replace(/\D/g, ""))) || 0 })} />
        </label>
        <label className="text-sm font-medium text-ink">Rango hasta
          <input className={`${INPUT} mt-1`} inputMode="numeric" value={b.rangeTo} onChange={(e) => set({ rangeTo: Math.floor(Number(e.target.value.replace(/\D/g, ""))) || 0 })} />
        </label>
        <p className="col-span-2 text-xs text-ink-soft">
          Si cambias la resolución o el prefijo, la numeración vuelve a empezar en el &quot;desde&quot;.
        </p>
        {msg && <p className="col-span-2 rounded-lg bg-cream px-3 py-2 text-sm text-ink">{msg}</p>}
        <button type="submit" disabled={busy} className="col-span-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-60">
          {busy ? "Guardando..." : "Guardar datos de facturación"}
        </button>
      </form>
    </section>
  );
}
