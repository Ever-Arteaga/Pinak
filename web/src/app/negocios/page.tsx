"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth";
import { useBusiness } from "@/lib/business";
import { createBusiness } from "@/lib/businessApi";
import { AppHeader } from "@/components/AppHeader";
import { LoadingScreen } from "@/components/BusinessGate";
import { InvitationsBanner, VerifyEmailCard } from "@/components/InvitationsBanner";
import { BUSINESS_TYPES, PLAN_LIMITS, PLAN_NAMES } from "@/types/pinak";

export default function NegociosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { business, businesses, loading, error: loadError, retry, switchBusiness } = useBusiness();

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  if (authLoading || !user) return <LoadingScreen />;
  if (loadError && !business) return <LoadingScreen error={loadError} onRetry={retry} />;
  if (loading) return <LoadingScreen />;

  // Quién puede crear negocios depende del plan PROPIO de la persona, no del negocio que está viendo.
  const ownPlan = businesses.find((b) => b.ownerId === user.uid)?.plan ?? "emprendedor";
  const canCreate = PLAN_LIMITS[ownPlan].businesses > businesses.filter((b) => b.ownerId === user.uid).length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { businessId } = await createBusiness({ name, businessType: type, city });
      switchBusiness(businessId);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Negocios" />

      <div className="mx-auto max-w-md px-5 pt-6">
        <InvitationsBanner />
        <VerifyEmailCard />

        <section className="mt-4 rounded-2xl border border-line bg-white p-5">
          <h1 className="font-display text-sm font-semibold text-navy-900">Mis negocios</h1>
          <ul className="mt-3 flex flex-col gap-2">
            {businesses.map((b) => {
              const active = b.id === business?.id;
              return (
                <li
                  key={b.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    active ? "border-green-600/40 bg-green-100" : "border-line"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-900">
                      {b.name} {b.locked && <span aria-label="Bloqueado">🔒</span>}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {b.ownerId === user.uid ? "Dueño" : "Miembro"} · Plan {PLAN_NAMES[b.plan]} ·{" "}
                      {b.members.length} {b.members.length === 1 ? "persona" : "personas"}
                    </p>
                  </div>
                  {active ? (
                    <span className="text-xs font-semibold text-green-600">Activo</span>
                  ) : (
                    <button
                      onClick={() => {
                        switchBusiness(b.id);
                        router.push("/dashboard");
                      }}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-cream"
                    >
                      Abrir
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-navy-900">Agregar un negocio</h2>

          {canCreate ? (
            <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="newName" className="text-sm font-medium text-ink">
                  Nombre del negocio
                </label>
                <input
                  id="newName"
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Sede Centro"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newType" className="text-sm font-medium text-ink">
                    Tipo
                  </label>
                  <select
                    id="newType"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  >
                    <option value="">Selecciona</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newCity" className="text-sm font-medium text-ink">
                    Ciudad
                  </label>
                  <input
                    id="newCity"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
              >
                {busy ? "Creando..." : "Crear negocio"}
              </button>
            </form>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-ink-soft">
                {ownPlan === "premium"
                  ? "No se pudo habilitar un negocio nuevo."
                  : `Tu plan ${PLAN_NAMES[ownPlan]} incluye 1 negocio. Con Premium puedes administrar varios desde una sola cuenta, cada uno con sus propios movimientos y equipo.`}
              </p>
              {ownPlan !== "premium" && (
                <Link
                  href="/upgrade"
                  className="mt-3 inline-block rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
                >
                  Ver plan Premium
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
