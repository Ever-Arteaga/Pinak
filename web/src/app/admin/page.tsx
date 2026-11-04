"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth";
import { adminOverview, type AdminOverview, type AdminUserRow } from "@/lib/businessApi";
import { AppHeader } from "@/components/AppHeader";

type Filtro = "todos" | "essential" | "pro" | "premium" | "prueba" | "vencido" | "gratis" | "porVencer";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "gratis", label: "Gratis" },
  { id: "essential", label: "Essential" },
  { id: "pro", label: "Pro" },
  { id: "premium", label: "Premium" },
  { id: "prueba", label: "En prueba" },
  { id: "porVencer", label: "Por vencer (7 días)" },
  { id: "vencido", label: "Vencidos" },
];

const PLAN_LABEL = { emprendedor: "Gratis", essential: "Essential", pro: "Pro", premium: "Premium" } as const;
const STATE_LABEL = { gratis: "—", pago: "Pagado", prueba: "Prueba", vencido: "Vencido" } as const;

function coincide(u: AdminUserRow, f: Filtro): boolean {
  switch (f) {
    case "todos":
      return true;
    case "gratis":
      return u.state === "gratis";
    case "essential":
      return u.plan === "essential" && (u.state === "pago" || u.state === "prueba");
    case "pro":
      return u.plan === "pro" && (u.state === "pago" || u.state === "prueba");
    case "premium":
      return u.plan === "premium" && (u.state === "pago" || u.state === "prueba");
    case "prueba":
      return u.state === "prueba";
    case "vencido":
      return u.state === "vencido";
    case "porVencer":
      return (u.state === "pago" || u.state === "prueba") && u.daysLeft !== null && u.daysLeft <= 7;
  }
}

function fecha(ms: number | null): string {
  return ms === null ? "—" : new Date(ms).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  /** `silencioso` = refresco automático: no parpadea ni borra el error anterior hasta tener respuesta. */
  async function cargar(silencioso = false) {
    if (!silencioso) {
      setCargando(true);
      setError(null);
    }
    try {
      setData(await adminOverview({}));
      setActualizado(new Date());
      setError(null);
    } catch (e) {
      if (!silencioso) setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  useEffect(() => {
    if (user) void cargar();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Se actualiza solo cada 15 segundos mientras la pestaña esté visible (y al volver a ella).
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (document.visibilityState === "visible") void cargar(true);
    };
    const id = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data?.users ?? []).filter(
      (u) => coincide(u, filtro) && (!q || u.email.toLowerCase().includes(q) || u.businessName.toLowerCase().includes(q))
    );
  }, [data, filtro, busqueda]);

  const s = data?.summary;
  const tarjetas = s
    ? [
        { label: "Usuarios", valor: s.total },
        { label: "Gratis", valor: s.gratis },
        { label: "Essential (pagan)", valor: s.essentialPago },
        { label: "Pro (pagan)", valor: s.proPago },
        { label: "Premium (pagan)", valor: s.premiumPago },
        { label: "En prueba", valor: s.proPrueba + s.premiumPrueba },
        { label: "Por vencer (7 d)", valor: s.porVencer7 },
        { label: "Vencidos", valor: s.vencidos },
      ]
    : [];

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" title="Administración" />
      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-3xl md:px-8 lg:max-w-5xl">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-ink-soft">
          <span>
            {cargando
              ? "Cargando..."
              : actualizado
              ? `Se actualiza solo · última vez ${actualizado.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
              : ""}
          </span>
          <button type="button" onClick={() => void cargar()} disabled={cargando} className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-navy-900 transition hover:bg-green-100 disabled:opacity-60">
            Actualizar ahora
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {s && (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {tarjetas.map((t) => (
                <div key={t.label} className="rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-ink-soft">{t.label}</p>
                  <p className="font-display mt-1 text-2xl font-semibold text-navy-900">{t.valor}</p>
                </div>
              ))}
            </section>

            <section className="mt-4 rounded-2xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltro(f.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      filtro === f.id
                        ? "border-green-500 bg-green-100 text-navy-900"
                        : "border-line text-ink-soft hover:bg-cream"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void cargar()}
                  className="ml-auto rounded-lg border border-line px-3 py-1 text-xs font-semibold text-navy-900 hover:bg-cream"
                >
                  Actualizar
                </button>
              </div>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por correo o negocio"
                className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                      <th className="py-2 pr-3 font-medium">Correo</th>
                      <th className="py-2 pr-3 font-medium">Negocio</th>
                      <th className="py-2 pr-3 font-medium">Plan</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 pr-3 font-medium">Vence</th>
                      <th className="py-2 font-medium">Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((u) => (
                      <tr key={u.uid} className="border-b border-line last:border-0">
                        <td className="max-w-[200px] truncate py-2 pr-3 text-ink">{u.email || "—"}</td>
                        <td className="max-w-[160px] truncate py-2 pr-3 text-ink-soft">{u.businessName || "—"}</td>
                        <td className="py-2 pr-3 font-semibold text-navy-900">{PLAN_LABEL[u.plan]}</td>
                        <td className={`py-2 pr-3 ${u.state === "vencido" ? "text-danger" : "text-ink-soft"}`}>
                          {STATE_LABEL[u.state]}
                        </td>
                        <td className="py-2 pr-3 text-ink-soft">
                          {fecha(u.expiresMs)}
                          {u.state !== "gratis" && u.state !== "vencido" && u.daysLeft !== null && (
                            <span className="text-xs"> ({u.daysLeft} d)</span>
                          )}
                        </td>
                        <td className="py-2 text-ink-soft">{fecha(u.createdMs)}</td>
                      </tr>
                    ))}
                    {filas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-sm text-ink-soft">
                          Nadie coincide con este filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                {filas.length} de {data?.users.length} usuarios
                {data?.truncated ? " (lista limitada a los primeros 2000)" : ""}.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
