"use client";

import { useState } from "react";
import { useBusiness } from "@/lib/business";
import { SetupModal } from "@/components/SetupModal";
import { PLAN_LIMITS } from "@/types/pinak";

/** Invita al dueño de un negocio Premium a responder el cuestionario (una sola vez). */
export function SetupBanner() {
  const { business, isOwner } = useBusiness();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!business || !isOwner || hidden) return null;
  if (!PLAN_LIMITS[business.plan].agenda || business.usesAppointments !== undefined) return null;

  return (
    <>
      <section className="mt-4 rounded-2xl border border-green-600/30 bg-green-100 p-4">
        <p className="text-sm font-semibold text-navy-900">Personaliza Pinak para tu negocio</p>
        <p className="mt-1 text-sm text-ink-soft">
          Responde 2 preguntas y activamos la agenda de citas si atiendes con cita previa.
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setOpen(true)} className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy-800">
            Responder
          </button>
          <button onClick={() => setHidden(true)} className="rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream">
            Más tarde
          </button>
        </div>
      </section>
      {open && <SetupModal business={business} onClose={() => setOpen(false)} />}
    </>
  );
}
