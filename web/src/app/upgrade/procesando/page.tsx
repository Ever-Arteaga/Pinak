"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth";
import { useUserProfile } from "@/lib/userProfile";
import { AppHeader } from "@/components/AppHeader";

export default function ProcessingPaymentPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  // El webhook de Wompi actualiza el plan en Firestore en segundo plano;
  // useUserProfile ya escucha ese documento en tiempo real, así que en
  // cuanto cambie el plan, redirigimos solos al dashboard.
  useEffect(() => {
    if (profile && profile.plan !== "emprendedor") {
      const t = setTimeout(() => router.replace("/dashboard"), 1200);
      return () => clearTimeout(t);
    }
  }, [profile, router]);

  useEffect(() => {
    const t = setTimeout(() => setWaitedTooLong(true), 15000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" />

      <div className="mx-auto flex max-w-md flex-col items-center px-5 pt-20 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-navy-900" />
        <h1 className="font-display mt-6 text-lg font-semibold text-navy-900">
          Confirmando tu pago...
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Esto suele tardar unos segundos. No cierres esta pantalla.
        </p>

        {waitedTooLong && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
            Esto está tardando más de lo normal. Si ya pagaste, tu plan se
            activará en cuanto confirmemos el pago — puedes cerrar esta
            pantalla y revisar más tarde.
          </p>
        )}
      </div>
    </main>
  );
}
