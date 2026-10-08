"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth";
import { useBusiness } from "@/lib/business";
import { generateDiagnosis } from "@/lib/businessApi";
import { useDiagnosis } from "@/lib/diagnosis";
import { usePrivacy } from "@/lib/privacy";
import { monthIdOf, monthLabel, previousMonthId } from "@/lib/months";
import { useBusinessGate } from "@/components/BusinessGate";
import { AppHeader } from "@/components/AppHeader";
import { PLAN_LIMITS } from "@/types/pinak";

const MAX_GENERATIONS = 3; // el servidor aplica el mismo tope

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p
        className={`font-display mt-0.5 text-base font-semibold ${
          tone === "bad" ? "text-danger" : tone === "good" ? "text-green-600" : "text-navy-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function pct(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  return `${n > 0 ? "+" : ""}${n.toLocaleString("es-CO")} %`;
}

export default function DiagnosticoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { business } = useBusiness();
  const { money, enabled: privacyEnabled } = usePrivacy();

  const current = monthIdOf(Date.now());
  const months = [current, previousMonthId(current)];
  const [month, setMonth] = useState(current);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const allowed = !!business && PLAN_LIMITS[business.plan].diagnosis;
  const { diagnosis, loading: diagLoading } = useDiagnosis(business?.id, month, allowed);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    setError(null);
    setRevealed(false);
  }, [month, business?.id]);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      await generateDiagnosis({ businessId: biz.id, month });
      // El resultado llega solo por la escucha en tiempo real.
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const used = diagnosis?.generationCount ?? 0;
  const remaining = Math.max(0, MAX_GENERATIONS - used);
  const hideText = privacyEnabled && !revealed;
  const s = diagnosis?.stats;

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Diagnóstico financiero" />

      <div className="mx-auto max-w-md px-5 pt-6">
        {!allowed ? (
          <section className="rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-3xl" aria-hidden>
              🩺
            </p>
            <h1 className="font-display mt-2 text-base font-semibold text-navy-900">
              Diagnóstico financiero con IA
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Cada mes, la IA analiza tus ingresos, gastos y fiados, y te explica en lenguaje
              sencillo cómo le fue a tu negocio y qué puedes mejorar. Disponible en el plan Premium.
            </p>
            <Link
              href="/upgrade"
              className="mt-4 inline-block rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Ver plan Premium
            </Link>
          </section>
        ) : (
          <>
            <div className="flex gap-2">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                    m === month
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-line bg-white text-navy-900 hover:bg-cream"
                  }`}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>

            {diagLoading ? (
              <p className="mt-6 text-center text-sm text-ink-soft">Cargando...</p>
            ) : !diagnosis || !s ? (
              <section className="mt-4 rounded-2xl border border-line bg-white p-6 text-center">
                <p className="text-3xl" aria-hidden>
                  🩺
                </p>
                <h1 className="font-display mt-2 text-base font-semibold text-navy-900">
                  Diagnóstico de {monthLabel(month)}
                </h1>
                <p className="mt-2 text-sm text-ink-soft">
                  Analizamos los movimientos y fiados de este mes en {biz.name} y te contamos qué
                  está pasando y qué hacer. Toma unos segundos.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="mt-4 rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
                >
                  {generating ? "Analizando tu negocio..." : "Generar diagnóstico"}
                </button>
              </section>
            ) : (
              <>
                <section className="mt-4 grid grid-cols-2 gap-3">
                  <Kpi label="Ingresos" value={money(s.income)} />
                  <Kpi label="Egresos" value={money(s.expenses)} />
                  <Kpi label="Balance" value={money(s.balance)} tone={s.balance >= 0 ? "good" : "bad"} />
                  <Kpi
                    label="Margen"
                    value={privacyEnabled ? "••••" : s.marginPct === null ? "—" : `${s.marginPct} %`}
                    tone={s.marginPct !== null && s.marginPct < 0 ? "bad" : undefined}
                  />
                </section>

                {s.change && !privacyEnabled && (
                  <p className="mt-3 text-xs text-ink-soft">
                    Frente a {monthLabel(previousMonthId(month))}:{" "}
                    {pct(s.change.incomePct) ? `ingresos ${pct(s.change.incomePct)}` : "ingresos sin comparación"}
                    {" · "}
                    {pct(s.change.expensesPct) ? `egresos ${pct(s.change.expensesPct)}` : "egresos sin comparación"}
                  </p>
                )}

                {hideText ? (
                  <section className="mt-4 rounded-2xl border border-line bg-white p-5 text-center">
                    <p className="text-sm text-ink-soft">
                      El análisis puede mencionar montos, así que está oculto por tu modo privacidad.
                    </p>
                    <button
                      onClick={() => setRevealed(true)}
                      className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-cream"
                    >
                      Mostrar análisis
                    </button>
                  </section>
                ) : (
                  <>
                    {diagnosis.alerta && (
                      <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-danger">⚠️ Atención</p>
                        <p className="mt-1 text-sm text-ink">{diagnosis.alerta}</p>
                      </section>
                    )}

                    <section className="mt-4 rounded-2xl border border-line bg-white p-5">
                      <h2 className="font-display text-sm font-semibold text-navy-900">Resumen</h2>
                      <p className="mt-2 text-sm leading-relaxed text-ink">{diagnosis.resumen}</p>
                    </section>

                    {diagnosis.hallazgos.length > 0 && (
                      <section className="mt-4 rounded-2xl border border-line bg-white p-5">
                        <h2 className="font-display text-sm font-semibold text-navy-900">
                          Lo que encontramos
                        </h2>
                        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink">
                          {diagnosis.hallazgos.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {diagnosis.recomendaciones.length > 0 && (
                      <section className="mt-4 rounded-2xl border border-green-600/30 bg-green-100 p-5">
                        <h2 className="font-display text-sm font-semibold text-navy-900">
                          Qué puedes hacer
                        </h2>
                        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-navy-900">
                          {diagnosis.recomendaciones.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ol>
                      </section>
                    )}
                  </>
                )}

                {s.topExpenseCategories.length > 0 && (
                  <section className="mt-4 rounded-2xl border border-line bg-white p-5">
                    <h2 className="font-display text-sm font-semibold text-navy-900">
                      En qué se va tu dinero
                    </h2>
                    <ul className="mt-3 flex flex-col gap-3">
                      {s.topExpenseCategories.map((c) => (
                        <li key={c.category}>
                          <div className="flex justify-between text-sm">
                            <span className="text-ink">{c.category}</span>
                            <span className="text-ink-soft">
                              {money(c.amount)} · {c.pct} %
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream">
                            <div
                              className="h-full rounded-full bg-navy-700"
                              style={{ width: `${Math.min(100, c.pct)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <p className="mt-4 text-center text-xs text-ink-soft">
                  {diagnosis.generatedAt &&
                    `Generado el ${diagnosis.generatedAt.toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                    })} · `}
                  {remaining > 0
                    ? `Puedes actualizarlo ${remaining} ${remaining === 1 ? "vez" : "veces"} más este mes.`
                    : "Ya usaste las actualizaciones de este mes."}
                </p>
                {remaining > 0 && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="mx-auto mt-2 block rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-cream disabled:opacity-60"
                  >
                    {generating ? "Actualizando..." : "Actualizar diagnóstico"}
                  </button>
                )}
              </>
            )}

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
            <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-soft">
              Orientación generada por IA a partir de tus registros. No reemplaza la asesoría de un
              contador.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
