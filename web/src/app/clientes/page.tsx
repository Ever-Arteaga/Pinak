"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PremiumLock } from "@/components/PremiumLock";
import { PLAN_LIMITS } from "@/types/pinak";
import { CustomerModal } from "@/components/CustomerModal";
import { useBusiness } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { useCustomers } from "@/lib/customers";
import type { Customer } from "@/types/pinak";

export default function ClientesPage() {
  const { business } = useBusiness();
  const { items, loading, error, retry } = useCustomers(business?.id);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((c) => `${c.name} ${c.phone} ${c.document}`.toLowerCase().includes(s)) : items;
  }, [items, q]);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;
  if (!PLAN_LIMITS[biz.plan].invoicing) return <PremiumLock title="Clientes" />;

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Clientes" />
      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
        <button onClick={() => setCreating(true)} className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-500">
          + Nuevo cliente
        </button>
        {items.length > 4 && (
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono o documento"
            className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        )}

        <div className="mt-5 flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {error && (
            <div className="px-4 py-6 text-center lg:col-span-2">
              <p className="text-sm text-danger">{error}</p>
              <button onClick={retry} className="mt-3 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
            </div>
          )}
          {loading && <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft lg:col-span-2">Cargando clientes...</p>}
          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center lg:col-span-2">
              <p className="text-sm font-medium text-ink">Aún no tienes clientes</p>
              <p className="mt-1 text-sm text-ink-soft">Se guardan solos al hacer un recibo, o agrégalos aquí.</p>
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setEditing(c)}
              className="rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:bg-cream"
            >
              <p className="text-sm font-semibold text-ink">{c.name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {[c.phone, c.document, c.email].filter(Boolean).join(" · ") || "Sin más datos"}
              </p>
            </button>
          ))}
        </div>
      </div>
      {creating && <CustomerModal businessId={biz.id} onClose={() => setCreating(false)} />}
      {editing && <CustomerModal businessId={biz.id} editing={editing} onClose={() => setEditing(null)} />}
    </main>
  );
}
