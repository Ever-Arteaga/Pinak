"use client";

import { useState } from "react";
import { updateBusinessSetup } from "@/lib/business";
import { APPOINTMENT_TYPES, BUSINESS_TYPES, type Business } from "@/types/pinak";

/** Cuestionario del negocio: tipo de negocio y si atiende con citas. Activa la agenda. */
export function SetupModal({ business, onClose }: { business: Business; onClose: () => void }) {
  const [type, setType] = useState(business.businessType);
  const [citas, setCitas] = useState<boolean | null>(business.usesAppointments ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickType(t: string) {
    setType(t);
    // Si aún no ha respondido la segunda pregunta, se le sugiere según el tipo.
    if (business.usesAppointments === undefined && (citas === null || citas === APPOINTMENT_TYPES.includes(type))) {
      setCitas(APPOINTMENT_TYPES.includes(t));
    }
  }

  async function save() {
    setError(null);
    if (!type) return setError("Elige a qué se dedica tu negocio.");
    if (citas === null) return setError("Responde si atiendes con citas.");
    setBusy(true);
    try {
      await updateBusinessSetup(business.id, { businessType: type, usesAppointments: citas });
      onClose();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">Cuéntanos de tu negocio</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Cerrar">✕</button>
        </div>

        <p className="text-sm font-medium text-ink">1. ¿A qué se dedica?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BUSINESS_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pickType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${type === t ? "border-green-500 bg-green-100 text-navy-900" : "border-line text-ink-soft hover:bg-cream"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <p className="mt-5 text-sm font-medium text-ink">2. ¿Atiendes con citas o reservas?</p>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Atiende con citas">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={citas === v}
              onClick={() => setCitas(v)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${citas === v ? "border-green-500 bg-green-100 text-navy-900" : "border-line text-ink-soft hover:bg-cream"}`}
            >
              {v ? "Sí, uso agenda" : "No, vendo directo"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Con agenda puedes programar citas, recordarlas por WhatsApp y cobrarlas con un recibo. Lo puedes cambiar cuando quieras desde tu perfil.
        </p>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}

        <button onClick={() => void save()} disabled={busy} className="mt-5 w-full rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60">
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
