"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PremiumLock } from "@/components/PremiumLock";
import { PLAN_LIMITS } from "@/types/pinak";
import { ProductModal } from "@/components/ProductModal";
import { useBusiness } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { usePrivacy } from "@/lib/privacy";
import { useProducts } from "@/lib/products";
import type { Product } from "@/types/pinak";

export default function ProductosPage() {
  const { business } = useBusiness();
  const { money } = usePrivacy();
  const { items, loading, error, retry } = useProducts(business?.id);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;
  if (!PLAN_LIMITS[biz.plan].invoicing) return <PremiumLock title="Catálogo" />;

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Catálogo" />
      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
        <p className="text-sm text-ink-soft">Carga lo que vendes una sola vez y agrégalo a un recibo con un toque.</p>
        <button onClick={() => setCreating(true)} className="mt-3 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-500">
          + Nuevo producto o servicio
        </button>

        <div className="mt-5 flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {error && (
            <div className="px-4 py-6 text-center lg:col-span-2">
              <p className="text-sm text-danger">{error}</p>
              <button onClick={retry} className="mt-3 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Reintentar</button>
            </div>
          )}
          {loading && <p className="rounded-2xl border border-line bg-white px-4 py-6 text-center text-sm text-ink-soft lg:col-span-2">Cargando catálogo...</p>}
          {!loading && !error && items.length === 0 && (
            <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center lg:col-span-2">
              <p className="text-sm font-medium text-ink">Tu catálogo está vacío</p>
              <p className="mt-1 text-sm text-ink-soft">Agrega tus productos o servicios con su precio.</p>
            </div>
          )}
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="flex items-center justify-between rounded-2xl border border-line bg-white p-4 text-left shadow-sm transition hover:bg-cream"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{p.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{p.kind === "servicio" ? "Servicio" : "Producto"}</p>
              </div>
              <p className="text-sm font-semibold text-navy-900">{money(p.price)}</p>
            </button>
          ))}
        </div>
      </div>
      {creating && <ProductModal businessId={biz.id} onClose={() => setCreating(false)} />}
      {editing && <ProductModal businessId={biz.id} editing={editing} onClose={() => setEditing(null)} />}
    </main>
  );
}
