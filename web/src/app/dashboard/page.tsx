"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthUser } from "@/lib/auth";
import { logoutUser } from "@/lib/auth";
import { useUserProfile } from "@/lib/userProfile";
import { usePrivacy } from "@/lib/privacy";
import { EyeIcon, EyeOffIcon } from "@/components/PrivacyIcons";
import { computeBalance, useTransactions } from "@/lib/transactions";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { AiQuickAddModal } from "@/components/AiQuickAddModal";
import { AppHeader } from "@/components/AppHeader";
import { BarChart } from "@/components/BarChart";
import { localDateKey } from "@/lib/dates";
import { PLAN_LIMITS, type Transaction } from "@/types/pinak";

function agruparUltimos7Dias(transactions: Transaction[]) {
  const hoy = new Date();
  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - (6 - i));
    return {
      clave: localDateKey(fecha),
      label: fecha.toLocaleDateString("es-CO", { weekday: "short" }),
      ingreso: 0,
      egreso: 0,
    };
  });

  transactions.forEach((t) => {
    const clave = localDateKey(t.date);
    const dia = dias.find((d) => d.clave === clave);
    if (!dia) return;
    if (t.type === "ingreso") dia.ingreso += t.amount;
    else dia.egreso += t.amount;
  });

  return dias;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const { money, available: privacyAvailable, enabled: privacyEnabled, toggle: togglePrivacy } =
    usePrivacy();
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
  const datosGrafica = agruparUltimos7Dias(transactions);

  return (
    <main className="min-h-screen bg-cream pb-24">
      {/* Header */}
      <AppHeader onLogout={() => logoutUser()} />

      <div className="mx-auto max-w-md px-5 pt-6">
        {/* Tarjeta de balance total */}
        <section className="rounded-2xl bg-navy-900 p-6 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70">Balance total</p>
            {privacyAvailable && (
              <button
                onClick={() => togglePrivacy()}
                aria-label={privacyEnabled ? "Mostrar montos" : "Ocultar montos"}
                title={privacyEnabled ? "Mostrar montos" : "Ocultar montos"}
                className="-mr-2 -mt-2 rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {privacyEnabled ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            )}
          </div>
          <p className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {money(balance)}
          </p>
          <div className="mt-5 flex gap-6">
            <div>
              <p className="text-xs text-white/60">Ingresos</p>
              <p className="text-sm font-medium text-green-500">
                {money(totalIngresos)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Egresos</p>
              <p className="text-sm font-medium text-red-300">
                {money(totalEgresos)}
              </p>
            </div>
          </div>
        </section>

        {/* Gráfica de ingresos vs egresos */}
        <section className="mt-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-navy-900">
            Últimos 7 días
          </h2>
          <div className="mt-3">
            <BarChart data={datosGrafica} formatValue={(v) => money(v)} />
          </div>
        </section>

        {/* Registro rápido con IA — solo planes Pro y Premium */}
        {profile && PLAN_LIMITS[profile.plan].aiEnabled && (
          <button
            onClick={() => setShowAiModal(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <span aria-hidden>✨</span>
            Registrar con IA (voz o texto)
          </button>
        )}

        {profile && !PLAN_LIMITS[profile.plan].aiEnabled && (
          <Link
            href="/upgrade"
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-line bg-white px-4 py-3.5 text-sm transition hover:bg-cream"
          >
            <span className="text-ink">
              <span aria-hidden>✨</span> Registra tus ventas hablando o
              escribiendo con IA
            </span>
            <span className="whitespace-nowrap font-semibold text-navy-900">
              Actualizar →
            </span>
          </Link>
        )}

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
                  {money(t.amount)}
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
