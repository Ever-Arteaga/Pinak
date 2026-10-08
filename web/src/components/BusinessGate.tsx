"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuthUser } from "@/lib/auth";
import { useBusiness } from "@/lib/business";
import { AppHeader } from "./AppHeader";

export function LoadingScreen({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
      {error ? (
        <>
          <p className="max-w-xs text-sm text-danger">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Reintentar
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-soft">Cargando...</p>
      )}
    </main>
  );
}

function LockedScreen({ isOwner, name }: { isOwner: boolean; name: string }) {
  return (
    <main className="min-h-screen bg-cream">
      <AppHeader title="Negocio bloqueado" />
      <div className="mx-auto max-w-md px-5 pt-10 text-center">
        <p className="text-3xl" aria-hidden>
          🔒
        </p>
        <h1 className="font-display mt-3 text-lg font-semibold text-navy-900">
          {name} está bloqueado
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {isOwner
            ? "Tu plan venció y este negocio ya no cabe en el plan gratuito. Tus datos están a salvo: renueva tu plan Premium para volver a usarlo."
            : "El plan del dueño de este negocio venció. Pídele que lo renueve para volver a entrar. Mientras tanto puedes cambiar a otro negocio desde el menú."}
        </p>
        {isOwner && (
          <Link
            href="/upgrade"
            className="mt-5 inline-block rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
          >
            Ver planes
          </Link>
        )}
      </div>
    </main>
  );
}

/**
 * Cada página que muestra datos de un negocio lo llama después de sus hooks.
 * Devuelve la pantalla que corresponde (cargando, error o bloqueado) o null
 * cuando el negocio está listo y la página puede dibujarse.
 */
export function useBusinessGate(): ReactNode | null {
  const { user, loading: authLoading } = useAuthUser();
  const { business, loading, error, retry, isOwner } = useBusiness();

  if (authLoading || !user) return <LoadingScreen />;
  if (error && !business) return <LoadingScreen error={error} onRetry={retry} />;
  if (loading || !business) return <LoadingScreen />;
  if (business.locked) return <LockedScreen isOwner={isOwner} name={business.name} />;
  return null;
}
