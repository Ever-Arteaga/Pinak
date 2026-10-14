"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthUser } from "@/lib/auth";
import { useUserProfile } from "@/lib/userProfile";
import { AppHeader } from "@/components/AppHeader";

type Outcome = "waiting" | "success" | "failed";

export default function ProcessingPaymentPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("waiting");
  // Vencimiento que tenía el plan al abrir esta página: el pago se confirma
  // cuando el webhook lo cambia (sirve también al pasar de Pro a Premium).
  const baseline = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    // Bold agrega el estado del pago a la URL de redirección.
    const status = new URLSearchParams(window.location.search).get("bold-tx-status");
    setTxStatus(status);
    if (status === "rejected" || status === "failed") setOutcome("failed");
  }, []);

  useEffect(() => {
    if (!profile || outcome === "failed") return;
    const expires = profile.planExpiresAt ? profile.planExpiresAt.getTime() : null;
    if (baseline.current === undefined) {
      baseline.current = expires;
      return;
    }
    if (!profile.planTrial && profile.plan !== "emprendedor" && expires !== baseline.current) {
      setOutcome("success");
      const t = setTimeout(() => router.replace("/dashboard"), 1500);
      return () => clearTimeout(t);
    }
  }, [profile, outcome, router]);

  useEffect(() => {
    const t = setTimeout(() => setWaitedTooLong(true), 15000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" />

      <div className="mx-auto flex max-w-md flex-col items-center px-5 pt-20 text-center">
        {outcome === "failed" ? (
          <>
            <p className="text-4xl" aria-hidden>
              ⚠️
            </p>
            <h1 className="font-display mt-4 text-lg font-semibold text-navy-900">
              No se pudo completar el pago
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Tu plan no cambió y no se te cobró. Puedes intentarlo de nuevo cuando quieras.
            </p>
            <Link
              href="/upgrade"
              className="mt-5 rounded-lg bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Volver a planes
            </Link>
          </>
        ) : outcome === "success" ? (
          <>
            <p className="text-4xl" aria-hidden>
              ✅
            </p>
            <h1 className="font-display mt-4 text-lg font-semibold text-navy-900">¡Pago confirmado!</h1>
            <p className="mt-2 text-sm text-ink-soft">Tu plan ya está activo. Te llevamos al dashboard...</p>
          </>
        ) : (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-navy-900" />
            <h1 className="font-display mt-6 text-lg font-semibold text-navy-900">
              Confirmando tu pago...
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Esto suele tardar unos segundos. No cierres esta pantalla.
            </p>
            {waitedTooLong && (
              <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
                Esto está tardando más de lo normal.
                {txStatus === "approved" || !txStatus
                  ? " Si ya pagaste, tu plan se activará en cuanto confirmemos el pago — puedes cerrar esta pantalla y revisar más tarde."
                  : " Tu pago aún no aparece como aprobado."}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
