"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthUser } from "@/lib/auth";
import { logoutUser } from "@/lib/auth";
import { computeBalance, useTransactions } from "@/lib/transactions";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { AiQuickAddModal } from "@/components/AiQuickAddModal";
import { AppHeader } from "@/components/AppHeader";
import type { Transaction } from "@/types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { transactions, loading: txLoading } = useTransactions(user?.uid);
  const [showModal, setShowModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm text-ink-soft">Cargando...</p>
      </main>
    );
  }

  const { balance, totalIngresos, totalEgresos } = computeBalance(transactions);
  const recientes = transactions.slice(0, 8);

  return (
    <main className="min-h-screen bg-cream pb-24">
      {/* Header */}
      <AppHeader onLogout={() => logoutUser()} />

      <div className="mx-auto max-w-md px-5 pt-6">
        {/* Tarjeta de balance total */}
        <section className="rounded-2xl bg-navy-900 p-6 text-white shadow-sm">
          <p className="text-sm text-white/70">Balance total</p>
          <p className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {currency.format(balance)}
          </p>
          <div className="mt-5 flex gap-6">
            <div>
              <p className="text-xs text-white/60">Ingresos</p>
              <p className="text-sm font-medium text-green-500">
                {currency.format(totalIngresos)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Egresos</p>
              <p className="text-sm font-medium text-red-300">
                {currency.format(totalEgresos)}
              </p>
            </div>
          </div>
        </section>

        {/* Registro rápido con IA */}
        <button
          onClick={() => setShowAiModal(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          <span aria-hidden>✨</span>
          Registrar con IA (voz o texto)
        </button>

        {/* Acciones rápidas */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
          >
            + Nuevo registro
          </button>
          <Link
            href="/fiados"
            className="flex items-center justify-center rounded-xl border border-line bg-white py-3 text-sm font-semibold text-navy-900 transition hover:bg-green-100"
          >
            Fiados
          </Link>
          <Link
            href="/reportes"
            className="flex items-center justify-center rounded-xl border border-line bg-white py-3 text-sm font-semibold text-navy-900 transition hover:bg-green-100"
          >
            Reportes
          </Link>
        </div>

        {/* Últimas transacciones */}
        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Movimientos recientes
          </h2>

          <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {txLoading && (
              <p className="px-4 py-6 text-center text-sm text-ink-soft">
                Cargando movimientos...
              </p>
            )}

            {!txLoading && recientes.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-ink">Aún no tienes registros</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Agrega tu primer ingreso o egreso para ver tu balance aquí.
                </p>
              </div>
            )}

            {recientes.map((t) => (
              <button
                key={t.id}
                onClick={() => setEditingTransaction(t)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-cream"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{t.category}</p>
                  <p className="text-xs text-ink-soft">
                    {t.method.charAt(0).toUpperCase() + t.method.slice(1)} ·{" "}
                    {t.date.toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    t.type === "ingreso" ? "text-green-600" : "text-danger"
                  }`}
                >
                  {t.type === "ingreso" ? "+" : "-"}
                  {currency.format(t.amount)}
                </p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {showModal && (
        <AddTransactionModal userId={user.uid} onClose={() => setShowModal(false)} />
      )}

      {showAiModal && (
        <AiQuickAddModal userId={user.uid} onClose={() => setShowAiModal(false)} />
      )}

      {editingTransaction && (
        <AddTransactionModal
          userId={user.uid}
          editingTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </main>
  );
}
