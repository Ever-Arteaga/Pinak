"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

/** Pantalla que se muestra cuando el plan del negocio no incluye recibos, clientes y catálogo. */
export function PremiumLock({
  title,
  heading = "Recibos, clientes y catálogo",
  text = "Guarda a tus clientes y lo que vendes, haz recibos en PDF con el logo de tu negocio y envíalos por WhatsApp. Disponible en el plan Premium.",
  icon = "🧾",
}: {
  title: string;
  heading?: string;
  text?: string;
  icon?: string;
}) {
  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title={title} />
      <div className="mx-auto w-full max-w-md px-5 pt-6 md:max-w-2xl md:px-8 lg:max-w-4xl">
        <section className="rounded-2xl border border-line bg-white p-6 text-center">
          <p className="text-3xl" aria-hidden>
            {icon}
          </p>
          <h1 className="font-display mt-2 text-base font-semibold text-navy-900">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">{text}</p>
          <Link
            prefetch={false}
            href="/upgrade"
            className="mt-4 inline-block rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
          >
            Ver plan Premium
          </Link>
        </section>
      </div>
    </main>
  );
}
