"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthUser } from "@/lib/auth";
import { useUserProfile, updateBusinessProfile } from "@/lib/userProfile";
import { AppHeader } from "@/components/AppHeader";
import { BUSINESS_TYPES, PLAN_LIMITS } from "@/types/pinak";

const NOMBRES_PLAN: Record<string, string> = {
  emprendedor: "Emprendedor",
  pro: "Pro",
  premium: "Premium",
};

export default function PerfilEmpresaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { profile, loading: profileLoading } = useUserProfile(user?.uid);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [nit, setNit] = useState("");
  const [description, setDescription] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Carga los datos guardados en el formulario cuando llegan de Firestore
  useEffect(() => {
    if (!profile) return;
    setBusinessName(profile.businessName);
    setBusinessType(profile.businessType);
    setPhone(profile.phone);
    setCity(profile.city);
    setNit(profile.nit);
    setDescription(profile.description);
  }, [profile]);

  if (authLoading || !user || profileLoading || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm text-ink-soft">Cargando...</p>
      </main>
    );
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardado(false);

    if (businessName.trim().length < 2) {
      setError("El nombre del negocio es muy corto.");
      return;
    }

    setGuardando(true);
    try {
      await updateBusinessProfile(user!.uid, {
        businessName: businessName.trim(),
        businessType,
        phone: phone.trim(),
        city: city.trim(),
        nit: nit.trim(),
        description: description.trim(),
      });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const iniciales = (businessName || "?").trim().slice(0, 2).toUpperCase();
  const miembroDesde = profile.createdAt
    ? profile.createdAt.toLocaleDateString("es-CO", { month: "long", year: "numeric" })
    : null;

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" title="Perfil de la empresa" />

      <div className="mx-auto max-w-md px-5 pt-6">
        {/* Cabecera del negocio */}
        <section className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-navy-900 text-lg font-semibold text-white">
            {iniciales}
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-base font-semibold text-navy-900">
              {businessName || "Tu negocio"}
            </h1>
            <p className="truncate text-sm text-ink-soft">{profile.email}</p>
          </div>
        </section>

        {/* Plan actual */}
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-white p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Plan actual</p>
            <p className="font-display mt-0.5 text-sm font-semibold text-navy-900">
              {NOMBRES_PLAN[profile.plan]}
              {PLAN_LIMITS[profile.plan].priceCOP > 0 && (
                <span className="font-normal text-ink-soft">
                  {" "}
                  ·{" "}
                  {new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: "COP",
                    maximumFractionDigits: 0,
                  }).format(PLAN_LIMITS[profile.plan].priceCOP)}
                  /mes
                </span>
              )}
            </p>
            {miembroDesde && (
              <p className="mt-0.5 text-xs text-ink-soft">Miembro desde {miembroDesde}</p>
            )}
          </div>
          <Link
            href="/upgrade"
            className="whitespace-nowrap rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream"
          >
            Cambiar plan
          </Link>
        </section>

        {/* Formulario de datos de la empresa */}
        <form
          onSubmit={handleGuardar}
          className="mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-display text-sm font-semibold text-navy-900">
            Datos del negocio
          </h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessName" className="text-sm font-medium text-ink">
              Nombre del negocio
            </label>
            <input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Ej. Tienda Doña Rosa"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessType" className="text-sm font-medium text-ink">
              Tipo de negocio
            </label>
            <select
              id="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            >
              <option value="">Selecciona uno</option>
              {BUSINESS_TYPES.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-medium text-ink">
                Teléfono
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="Ej. 3001234567"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="city" className="text-sm font-medium text-ink">
                Ciudad
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="Ej. Cartagena"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nit" className="text-sm font-medium text-ink">
              NIT o documento (opcional)
            </label>
            <input
              id="nit"
              type="text"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Ej. 901234567-8"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-ink">
              Descripción breve (opcional)
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="¿A qué se dedica tu negocio?"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          )}
          {guardado && (
            <p className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-600">
              Perfil actualizado.
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="mt-1 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>
    </main>
  );
}
