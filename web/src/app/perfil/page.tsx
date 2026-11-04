"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthUser } from "@/lib/auth";
import { useBusiness, updateBusinessProfile, updateBusinessPhoto } from "@/lib/business";
import { useBusinessGate } from "@/components/BusinessGate";
import { usePersonal } from "@/lib/personal";
import { AppHeader } from "@/components/AppHeader";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { SetupModal } from "@/components/SetupModal";
import { BillingSection } from "@/components/BillingSection";
import { BUSINESS_TYPES, PLAN_LIMITS, PLAN_NAMES } from "@/types/pinak";

/** Recorta al centro (cuadrado), reduce a 256 px y devuelve un JPEG como data URL (~15-30 KB). */
async function reducirImagen(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("imagen"));
      el.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(256, lado);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      img,
      (img.naturalWidth - lado) / 2,
      (img.naturalHeight - lado) / 2,
      lado,
      lado,
      0,
      0,
      size,
      size
    );
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PerfilEmpresaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { business, isOwner } = useBusiness();
  const personal = usePersonal();

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [nit, setNit] = useState("");
  const [description, setDescription] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
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

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Elige un archivo de imagen.");
      return;
    }
    setSubiendoFoto(true);
    try {
      await updateBusinessPhoto(biz.id, await reducirImagen(file));
    } catch {
      setError("No se pudo guardar la foto. Intenta con otra imagen.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function quitarFoto() {
    setError(null);
    setSubiendoFoto(true);
    try {
      await updateBusinessPhoto(biz.id, null);
    } catch {
      setError("No se pudo quitar la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardado(false);

    if (businessName.trim().length < 2) {
      setError(personal ? "El nombre de tu cuenta es muy corto." : "El nombre del negocio es muy corto.");
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
      <AppHeader backHref="/dashboard" title={personal ? "Mi perfil" : "Perfil de la empresa"} />

      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
        {/* Cabecera del negocio */}
        <section className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-900 text-lg font-semibold text-white">
            {biz.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={biz.photoURL} alt={personal ? "Tu foto" : "Foto del negocio"} className="h-full w-full object-cover" />
            ) : (
              iniciales
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-base font-semibold text-navy-900">
              {businessName || (personal ? "Tu cuenta" : "Tu negocio")}
            </h1>
            <p className="truncate text-sm text-ink-soft">{user?.email}</p>
            {isOwner && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />
                <button
                  type="button"
                  disabled={subiendoFoto}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy-900 transition hover:bg-cream disabled:opacity-60"
                >
                  {subiendoFoto ? "Guardando..." : biz.photoURL ? "Cambiar foto" : "Subir foto"}
                </button>
                {biz.photoURL && !subiendoFoto && (
                  <button
                    type="button"
                    onClick={quitarFoto}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-cream"
                  >
                    Quitar
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Plan actual */}
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-white p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">{personal ? "Tu plan" : "Plan del negocio"}</p>
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
            <Link prefetch={false}
              href="/upgrade"
              className="whitespace-nowrap rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream"
            >
              Cambiar plan
            </Link>
          )}
        </section>

        {/* Agenda de citas (Premium) */}
        {isOwner && PLAN_LIMITS[biz.plan].agenda && (
          <section className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-soft">Agenda de citas</p>
              <p className="font-display mt-0.5 text-sm font-semibold text-navy-900">
                {biz.usesAppointments === true ? "Activada" : biz.usesAppointments === false ? "Desactivada" : "Sin configurar"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="whitespace-nowrap rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream"
            >
              Configurar
            </button>
          </section>
        )}

        {/* Formulario de datos de la empresa */}
        <form
          onSubmit={handleGuardar}
          className="mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-display text-sm font-semibold text-navy-900">
            {personal ? "Datos de tu cuenta" : "Datos del negocio"}
          </h2>
          {!isOwner && (
            <p className="rounded-lg bg-cream px-3 py-2 text-xs text-ink-soft">
              Solo el dueño del negocio puede editar estos datos.
            </p>
          )}
          <fieldset disabled={!isOwner} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">

          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessName" className="text-sm font-medium text-ink">
              {personal ? "Tu nombre" : "Nombre del negocio"}
            </label>
            <input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder={personal ? "Ej. María Pérez" : "Ej. Tienda Doña Rosa"}
            />
          </div>

          {!personal && (
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
          )}

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
              {personal ? "Cédula (opcional)" : "NIT o documento (opcional)"}
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

          {!personal && (
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
          )}

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

        {isOwner && PLAN_LIMITS[biz.plan].invoicing && <BillingSection business={biz} />}
        <DeleteAccountSection />
        {setupOpen && <SetupModal business={biz} onClose={() => setSetupOpen(false)} />}
      </div>
    </main>
  );
}
