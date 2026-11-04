"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { expiryNotice } from "@pinak/shared/expiryNotice";
import { useAuthUser } from "@/lib/auth";
import { useUserProfile } from "@/lib/userProfile";

/** Aviso a 7, 3 y 1 día del vencimiento del plan. Se puede cerrar; reaparece en el siguiente escalón. */
export function ExpiryBanner() {
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const storageKey = user ? `pinak.expiryDismiss.${user.uid}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      setClosedKey(localStorage.getItem(storageKey));
    } catch {
      /* sin almacenamiento: el aviso solo se oculta mientras la página siga abierta */
    }
  }, [storageKey]);

  const notice = profile
    ? expiryNotice({
        plan: profile.plan,
        planTrial: profile.planTrial,
        expiresMs: profile.planExpiresAt ? profile.planExpiresAt.getTime() : null,
      })
    : null;
  if (!notice || notice.key === closedKey) return null;

  const urgente = notice.level === 1;

  function cerrar() {
    if (!notice) return;
    setClosedKey(notice.key);
    try {
      if (storageKey) localStorage.setItem(storageKey, notice.key);
    } catch {
      /* se ignora */
    }
  }

  return (
    <section
      role="status"
      className={`mt-4 rounded-2xl border p-4 ${
        urgente ? "border-danger/40 bg-red-50" : "border-green-600/30 bg-green-100"
      }`}
    >
      <p className="text-sm font-semibold text-navy-900">{notice.title}</p>
      <p className="mt-1 text-sm text-ink-soft">{notice.body}</p>
      <div className="mt-3 flex gap-2">
        <Link
          prefetch={false}
          href="/upgrade"
          className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy-800"
        >
          {profile?.planTrial ? "Elegir plan" : "Renovar"}
        </Link>
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream"
        >
          Cerrar
        </button>
      </div>
    </section>
  );
}
