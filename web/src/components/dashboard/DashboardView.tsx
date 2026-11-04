"use client";

import Link from "next/link";
import { formatPercent } from "@pinak/shared/dashboard";
import type { DashboardPeriod, DashboardState } from "@/lib/dashboard";
import { EyeIcon, EyeOffIcon } from "@/components/PrivacyIcons";
import type { ReactNode } from "react";
import { Delta } from "./Delta";
import { MiniBars } from "./MiniBars";
import { FlowChart } from "./FlowChart";
import { ExpenseBreakdown } from "./ExpenseBreakdown";
import { RecentMovements } from "./RecentMovements";
import { ReceivablesCard } from "./ReceivablesCard";
import { AiBar } from "./AiBar";
import { DashboardSkeleton } from "./Skeleton";
import { PLAN_LIMITS, type Plan, type Transaction } from "@/types/pinak";

const PERIODS: { id: DashboardPeriod; label: string; previous: string }[] = [
  { id: "7d", label: "7 días", previous: "7 días anteriores" },
  { id: "30d", label: "30 días", previous: "30 días anteriores" },
  { id: "12m", label: "12 meses", previous: "12 meses anteriores" },
];

const card = "min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5";

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className={`${card} flex flex-col gap-1.5`}>
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</h2>
      {children}
    </section>
  );
}

export interface DashboardViewProps {
  businessName: string;
  plan: Plan;
  userName: string;
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  dash: DashboardState;
  money: (n: number) => string;
  privacy: { available: boolean; enabled: boolean; toggle: () => void };
  onNewTransaction: () => void;
  onAiDetect: (text: string, voice: boolean) => void;
  onSelectTransaction: (t: Transaction) => void;
  /** Cabecera de la app (menú lateral, cerrar sesión). */
  header?: ReactNode;
  /** Aviso de invitaciones pendientes. */
  banner?: ReactNode;
}

/** Pantalla del dashboard (presentacional: recibe todo por props). */
export function DashboardView({
  businessName, plan, userName, period, onPeriodChange, dash, money, privacy,
  onNewTransaction, onAiDetect, onSelectTransaction, header, banner,
}: DashboardViewProps) {
  const personal = plan === "essential";
  const { data, receivables, recent, nowMs } = dash;
  const { available: privacyAvailable, enabled: privacyEnabled, toggle: togglePrivacy } = privacy;
  const previousLabel = PERIODS.find((p) => p.id === period)!.previous;
  const fecha = new Date(nowMs).toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota",
  });
  const fechaTexto = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  const aiEnabled = PLAN_LIMITS[plan].aiEnabled;
  const diagnosisEnabled = PLAN_LIMITS[plan].diagnosis;
  const noData = !dash.loading && !dash.error && recent.length === 0 && data.isEmpty;
  const { totals, comparison } = data;

  return (
    <main className="min-h-screen bg-cream pb-24">
      {header}

      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 pt-6 sm:px-6">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-ink-soft">{fechaTexto}</p>
            <h1 className="font-display text-2xl font-semibold text-navy-900">Hola, {userName}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Período" className="flex rounded-xl border border-line bg-white p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPeriodChange(p.id)}
                  aria-pressed={period === p.id}
                  className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold transition ${
                    period === p.id ? "bg-navy-900 text-white" : "text-ink-soft hover:bg-cream"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {privacyAvailable && (
              <button
                type="button"
                onClick={() => togglePrivacy()}
                aria-label={privacyEnabled ? "Mostrar montos" : "Ocultar montos"}
                aria-pressed={privacyEnabled}
                title={privacyEnabled ? "Mostrar montos" : "Ocultar montos"}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink-soft transition hover:bg-cream hover:text-navy-900"
              >
                {privacyEnabled ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            )}
            <button
              type="button"
              onClick={onNewTransaction}
              className="min-h-[44px] rounded-xl bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              + Nuevo registro
            </button>
          </div>
        </div>

        {banner}

        <AiBar enabled={aiEnabled} onDetect={onAiDetect} />

        {dash.error && (
          <div className={`${card} text-center`} role="alert">
            <p className="text-sm text-danger">{dash.error}</p>
            <button
              type="button"
              onClick={dash.retry}
              className="mt-3 min-h-[44px] rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Reintentar
            </button>
          </div>
        )}

        {dash.loading && !dash.error && <DashboardSkeleton />}

        {noData && (
          <div className={`${card} py-10 text-center`}>
            <p className="text-3xl" aria-hidden>🌱</p>
            <h2 className="font-display mt-2 text-lg font-semibold text-navy-900">Aún no tienes registros</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
              {personal ? "Registra tu primer ingreso o gasto y aquí verás" : "Registra tu primera venta o gasto y aquí verás"} tu balance, tu flujo de caja y en qué se va la plata.
            </p>
            <button
              type="button"
              onClick={onNewTransaction}
              className="mt-4 min-h-[44px] rounded-xl bg-green-600 px-5 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              Registrar mi primer movimiento
            </button>
          </div>
        )}

        {!dash.loading && !dash.error && !noData && (
          <>
            {data.isEmpty && (
              <p className="rounded-xl bg-white px-4 py-3 text-sm text-ink-soft">
                No hay movimientos en este período. Prueba con uno más largo.
              </p>
            )}

            {/* Indicadores */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <section className="col-span-2 flex flex-col gap-1.5 rounded-2xl bg-navy-900 p-4 text-white sm:p-5 md:col-span-1">
                <h2 className="text-xs font-medium uppercase tracking-wide text-white/70">Balance</h2>
                <p className="font-display text-2xl font-semibold tracking-tight">
                  {totals.balance < 0 && !privacyEnabled ? "-" : ""}
                  {money(Math.abs(totals.balance))}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Delta metric="balance" value={comparison.balancePct} onDark />
                  <span className="text-[11px] text-white/60">vs. {previousLabel}</span>
                </div>
              </section>

              <Kpi label="Ingresos">
                <p className="font-display text-xl font-semibold text-navy-900">{money(totals.income)}</p>
                <Delta metric="income" value={comparison.incomePct} />
                <MiniBars points={data.series} field="income" color="var(--pinak-bar-income)" />
              </Kpi>

              <Kpi label="Egresos">
                <p className="font-display text-xl font-semibold text-navy-900">{money(totals.expense)}</p>
                <Delta metric="expense" value={comparison.expensePct} />
                <MiniBars points={data.series} field="expense" color="var(--pinak-bar-expense)" />
              </Kpi>

              <Kpi label="Margen">
                <p className="font-display text-xl font-semibold text-navy-900">{formatPercent(totals.marginPct)}</p>
                <Delta metric="margin" value={comparison.marginPts} kind="points" />
                <p className="text-[11px] text-ink-soft">de cada $100 que entran, te quedan {totals.marginPct === null ? "—" : `$${Math.round(totals.marginPct)}`}</p>
              </Kpi>

              <Kpi label="Por cobrar">
                <p className="font-display text-xl font-semibold text-navy-900">{money(receivables.totalPending)}</p>
                <p className={`text-xs font-semibold ${receivables.overdueCount > 0 ? "text-danger" : "text-ink-soft"}`}>
                  {receivables.overdueCount > 0 && <span aria-hidden>⚠ </span>}
                  {receivables.overdueCount === 1 ? "1 vencido" : `${receivables.overdueCount} vencidos`}
                </p>
                <p className="text-[11px] text-ink-soft">
                  {receivables.pendingCount === 1 ? "1 fiado pendiente" : `${receivables.pendingCount} fiados pendientes`}
                </p>
              </Kpi>
            </div>

            {/* Flujo de caja + en qué se va la plata */}
            <div className="grid gap-4 xl:grid-cols-3">
              <section className={`${card} xl:col-span-2`}>
                <h2 className="font-display text-base font-semibold text-navy-900">Flujo de caja</h2>
                <p className="mb-3 text-xs text-ink-soft">Toca una barra para ver el detalle.</p>
                <FlowChart series={data.series} money={money} masked={privacyEnabled} />
              </section>
              <section className={card}>
                <ExpenseBreakdown categories={data.expenseByCategory} methods={data.incomeByMethod} money={money} />
              </section>
            </div>

            {/* Movimientos + fiados y diagnóstico */}
            <div className="grid gap-4 xl:grid-cols-3">
              <section className={`${card} xl:col-span-2`}>
                <RecentMovements transactions={recent} nowMs={nowMs} money={money} onSelect={onSelectTransaction} />
              </section>
              <div className="flex flex-col gap-4">
                <section className={card}>
                  <ReceivablesCard summary={receivables} businessName={businessName} money={money} />
                </section>
                <section className="rounded-2xl border border-green-600/30 bg-green-100 p-4 sm:p-5">
                  <h2 className="font-display text-base font-semibold text-navy-900">
                    <span aria-hidden>🩺</span> Diagnóstico con IA
                  </h2>
                  {diagnosisEnabled ? (
                    <>
                      <p className="mt-1 text-sm text-ink">{personal ? "Mira cómo van tus finanzas este mes y qué puedes mejorar." : "Mira cómo va tu negocio este mes y qué puedes mejorar."}</p>
                      <Link
                        prefetch={false}
                        href="/diagnostico"
                        className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition hover:bg-navy-800"
                      >
                        Ver mi diagnóstico
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-ink">
                        El diagnóstico mensual con IA está en el plan Premium.
                      </p>
                      <Link
                        prefetch={false}
                        href="/upgrade"
                        className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition hover:bg-navy-800"
                      >
                        Mejorar mi plan
                      </Link>
                    </>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>

    </main>
  );
}
