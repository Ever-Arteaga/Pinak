"use client";

import { useEffect, useState } from "react";
import { PLAN_LIMITS } from "@/types/pinak";

const KEY_SEEN = "pinak.intro.seen";
const KEY_PLAN = "pinak.intro.plan";

export function readIntroPlan(): string | null {
  try {
    return localStorage.getItem(KEY_PLAN);
  } catch {
    return null;
  }
}

const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const PLANES = [
  {
    id: "emprendedor",
    nombre: "Emprendedor",
    precio: "Gratis",
    items: ["Ingresos, egresos y fiados", "Reportes del mes", "1 usuario"],
  },
  {
    id: "pro",
    nombre: "Pro",
    precio: `${cop(PLAN_LIMITS.pro.priceCOP)}/mes`,
    items: ["Registro con IA por voz y texto", "2 usuarios", "Exporta a PDF y Excel"],
    destacado: true,
  },
  {
    id: "premium",
    nombre: "Premium",
    precio: `${cop(PLAN_LIMITS.premium.priceCOP)}/mes`,
    items: ["Todo lo de Pro", "Varios negocios y usuarios", "Diagnóstico financiero con IA", "Modo privacidad"],
  },
];

/** Pantalla de bienvenida para quien entra por primera vez: tres tarjetas flotantes con los planes. */
export function PlanIntro({ onChoose }: { onChoose: (plan: string) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY_SEEN)) setOpen(true);
    } catch {
      /* sin almacenamiento: no se muestra */
    }
  }, []);

  function elegir(id: string) {
    try {
      localStorage.setItem(KEY_SEEN, "1");
      localStorage.setItem(KEY_PLAN, id);
    } catch {}
    setOpen(false);
    onChoose(id);
  }

  function saltar() {
    try {
      localStorage.setItem(KEY_SEEN, "1");
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-900/95 px-5 py-8">
      <style>{`
        @keyframes pinak-rise { from { opacity: 0; transform: translateY(40px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes pinak-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .pinak-card { animation: pinak-rise .6s ease-out both, pinak-float 4s ease-in-out 1s infinite; }
        @media (prefers-reduced-motion: reduce) { .pinak-card { animation: none; } }
      `}</style>
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-center text-2xl font-semibold text-white">
          Elige el plan para tu negocio
        </h2>
        <p className="mt-1 text-center text-sm text-white/70">
          Puedes cambiarlo cuando quieras. Luego crea tu cuenta o inicia sesión.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PLANES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => elegir(p.id)}
              style={{ animationDelay: `${i * 0.15}s, ${1 + i * 0.4}s` }}
              className={`pinak-card flex flex-col rounded-2xl p-6 text-left shadow-xl transition hover:ring-2 hover:ring-green-500 ${
                p.destacado ? "bg-white ring-2 ring-green-500" : "bg-white/95"
              }`}
            >
              {p.destacado && (
                <span className="mb-2 w-fit rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-navy-900">
                  Más popular
                </span>
              )}
              <span className="font-display text-lg font-semibold text-navy-900">{p.nombre}</span>
              <span className="mt-1 text-sm font-semibold text-green-600">{p.precio}</span>
              <ul className="mt-4 flex flex-1 flex-col gap-1.5">
                {p.items.map((it) => (
                  <li key={it} className="text-sm text-ink-soft">✓ {it}</li>
                ))}
              </ul>
              <span className="mt-5 rounded-lg bg-navy-900 py-2 text-center text-sm font-semibold text-white">
                Elegir {p.nombre}
              </span>
            </button>
          ))}
        </div>
        <button onClick={saltar} className="mx-auto mt-6 block text-sm text-white/70 hover:text-white">
          Ya tengo cuenta
        </button>
      </div>
    </div>
  );
}
