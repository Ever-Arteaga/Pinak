"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthUser } from "@/lib/auth";
import { useBusiness, updateBusinessProfile } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { AppHeader } from "@/components/AppHeader";
import { BUSINESS_TYPES, PLAN_LIMITS, PLAN_NAMES } from "@/types/pinak";

export default function PerfilEmpresaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { business, isOwner } = useBusiness();

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

  // Carga en el formulario los datos guardados del negocio activo.
  const saved = business;
  useEffect(() => {
    if (!saved) return;
    setBusinessName(saved.name);
    setBusinessType(saved.businessType);
    setPhone(saved.phone);
    setCity(saved.city);
    setNit(saved.nit);
    setDescription(saved.description);
  }, [saved?.id, saved?.name, saved?.businessType, saved?.phone, saved?.city, saved?.nit, saved?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

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
      await updateBusinessProfile(biz.id, {
        name: businessName.trim(),
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
  const miembroDesde = biz.createdAt
    ? biz.createdAt.toLocaleDateString("es-CO", { month: "long", year: "numeric" })
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
            <p className="truncate text-sm text-ink-soft">{user?.email}</p>
          </div>
        </section>

        {/* Plan actual */}
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-white p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Plan del negocio</p>
            <p className="font-display mt-0.5 text-sm font-semibold text-navy-900">
              {PLAN_NAMES[biz.plan]}
              {PLAN_LIMITS[biz.plan].priceCOP > 0 && (
                <span className="font-normal text-ink-soft">
                  {" "}
                  ·{" "}
                  {new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: "COP",
                    maximumFractionDigits: 0,
                  }).format(PLAN_LIMITS[biz.plan].priceCOP)}
                  /mes
                </span>
              )}
            </p>
            {miembroDesde && (
              <p className="mt-0.5 text-xs text-ink-soft">Miembro desde {miembroDesde}</p>
            )}
          </div>
          {isOwner && (
            <Link
              href="/upgrade"
              className="whitespace-nowrap rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream"
            >
              Cambiar plan
            </Link>
          )}
        </section>

        {/* Formulario de datos de la empresa */}
        <form
          onSubmit={handleGuardar}
          className="mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-display text-sm font-semibold text-navy-900">
            Datos del negocio
          </h2>
          {!isOwner && (
            <p className="rounded-lg bg-cream px-3 py-2 text-xs text-ink-soft">
              Solo el dueño del negocio puede editar estos datos.
            </p>
          )}
          <fieldset disabled={!isOwner} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">

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
          </fieldset>
        </form>
      </div>
    </main>
  );
}
