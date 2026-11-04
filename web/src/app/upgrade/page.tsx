"use client";

import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/auth";
import { useUserProfile } from "@/lib/userProfile";
import { startPlanUpgrade } from "@/lib/payments";
import { freePlanAccess, startTrial } from "@/lib/businessApi";
import { AppHeader } from "@/components/AppHeader";
import { PLAN_LIMITS, PLAN_NAMES } from "@/types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type PayPlan = "essential" | "pro" | "premium";
const ORDER = { emprendedor: 0, essential: 1, pro: 2, premium: 3 } as const;

const PLAN_FEATURES: Record<PayPlan, string[]> = {
  essential: [
    "Pensado para tu cuenta personal",
    "Registra tus ingresos y gastos por voz y texto con IA",
    "Reportes exportables a PDF y Excel",
  ],
  pro: [
    "Registro por voz y texto con IA, sin límite",
    "2 usuarios en tu negocio (tú y una persona más)",
    "Reportes exportables a PDF y Excel",
  ],
  premium: [
    "Todo lo de Pro",
    "Usuarios ilimitados en cada negocio",
    "Varios negocios en una sola cuenta",
    "Diagnóstico financiero mensual con IA",
    "Recibos de venta en PDF, clientes y catálogo",
    "Agenda de citas con cobro",
    "Modo privacidad en pantalla",
    "Soporte prioritario",
  ],
};

export default function UpgradePage() {
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const [loadingPlan, setLoadingPlan] = useState<PayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trialMsg, setTrialMsg] = useState<string | null>(null);

  async function handleUpgrade(plan: PayPlan) {
    setError(null);
    setLoadingPlan(plan);
    try {
      await startPlanUpgrade(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setLoadingPlan(null);
    }
  }

  async function handleTrial(plan: PayPlan) {
    setError(null);
    setLoadingPlan(plan);
    try {
      await startTrial({ plan });
      setTrialMsg(`¡Listo! Tienes 10 días de ${PLAN_NAMES[plan]} gratis.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la prueba.");
    } finally {
      setLoadingPlan(null);
    }
  }

  function canTrial(plan: PayPlan) {
    if (!profile || profile.trialsUsed[plan]) return false;
    if (profile.plan === plan) return false;
    if (profile.plan === "emprendedor") return true;
    return profile.planTrial && ORDER[profile.plan] < ORDER[plan];
  }

  const [testAccess, setTestAccess] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  // Cuentas de pruebas (correos autorizados en el servidor): pueden cambiar de plan sin pagar.
  useEffect(() => {
    if (!user) return;
    freePlanAccess({}).then((r) => setTestAccess(r.enabled === true)).catch(() => setTestAccess(false));
  }, [user]);

  async function switchPlan(plan: "emprendedor" | "essential" | "pro" | "premium") {
    setError(null);
    setSwitching(plan);
    try {
      await freePlanAccess({ plan });
      setTrialMsg(`Listo, ahora estás en ${plan === "emprendedor" ? "Emprendedor (gratis)" : PLAN_NAMES[plan]}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el plan.");
    } finally {
      setSwitching(null);
    }
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Planes" />

      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
        <p className="text-center text-sm text-ink-soft">
          Tu plan actual:{" "}
          <span className="font-semibold text-navy-900">
            {profile?.plan === "emprendedor" && "Emprendedor (gratis)"}
            {profile?.plan === "essential" && "Essential"}
            {profile?.plan === "pro" && "Pro"}
            {profile?.plan === "premium" && "Premium"}
          </span>
        </p>

        {profile?.planTrial && profile.planExpiresAt && (
          <p className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-center text-xs text-green-600">
            Prueba gratuita activa hasta el{" "}
            {profile.planExpiresAt.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.
          </p>
        )}
        {trialMsg && (
          <p className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-center text-sm text-green-600">
            {trialMsg}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        )}

        {testAccess && (
          <section className="mt-4 rounded-2xl border border-dashed border-green-500 bg-white p-4">
            <p className="text-sm font-semibold text-navy-900">Cuenta de pruebas</p>
            <p className="mt-0.5 text-xs text-ink-soft">Cambia de plan sin pagar para probar cada uno.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["emprendedor", "essential", "pro", "premium"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => void switchPlan(p)}
                  disabled={switching !== null || profile?.plan === p}
                  className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream disabled:opacity-50"
                >
                  {profile?.plan === p ? "✓ " : ""}{p === "emprendedor" ? "Gratis" : PLAN_NAMES[p]}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 flex flex-col gap-4 md:grid md:grid-cols-3 md:items-start">
          {(["essential", "pro", "premium"] as const).map((plan) => {
            const isCurrent = profile?.plan === plan;
            return (
              <div
                key={plan}
                className={`rounded-2xl border p-5 ${
                  plan === "premium" ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h2
                    className={`font-display text-lg font-semibold ${
                      plan === "premium" ? "text-white" : "text-navy-900"
                    }`}
                  >
                    {PLAN_NAMES[plan]}
                  </h2>
                  <span
                    className={`text-sm font-semibold ${
                      plan === "premium" ? "text-white" : "text-navy-900"
                    }`}
                  >
                    {currency.format(PLAN_LIMITS[plan].priceCOP)}
                    <span className="text-xs font-normal opacity-70">/mes</span>
                  </span>
                </div>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {PLAN_FEATURES[plan].map((f) => (
                    <li
                      key={f}
                      className={`text-sm ${
                        plan === "premium" ? "text-white/90" : "text-ink-soft"
                      }`}
                    >
                      ✓ {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={(isCurrent && !profile?.planTrial) || loadingPlan !== null}
                  className={`mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    plan === "premium"
                      ? "bg-white text-navy-900 hover:bg-cream"
                      : "bg-navy-900 text-white hover:bg-navy-800"
                  }`}
                >
                  {isCurrent && !profile?.planTrial
                    ? "Tu plan actual"
                    : loadingPlan === plan
                    ? "Redirigiendo a pago..."
                    : `${profile?.planTrial && isCurrent ? "Pagar" : "Actualizar a"} ${PLAN_NAMES[plan]}`}
                </button>
                {canTrial(plan) && (
                  <button
                    onClick={() => handleTrial(plan)}
                    disabled={loadingPlan !== null}
                    className={`mt-2 w-full rounded-lg border py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                      plan === "premium"
                        ? "border-white/40 text-white hover:bg-white/10"
                        : "border-line text-navy-900 hover:bg-cream"
                    }`}
                  >
                    Probar 10 días gratis
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft">
          La prueba gratuita no pide tarjeta y se activa una sola vez por plan. Pagas de forma segura con Bold (Nequi, tarjeta, PSE). Tu plan se
          renueva mes a mes — te avisaremos antes de que venza.
        </p>
      </div>
    </main>
  );
}
