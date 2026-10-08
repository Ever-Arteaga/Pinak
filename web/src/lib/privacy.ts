"use client";

import { doc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "./firebase";
import { useAuthUser } from "./auth";
import { useUserProfile } from "./userProfile";
import { useBusiness } from "./business";
import { PLAN_LIMITS } from "@/types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Texto que reemplaza a los montos cuando el modo privacidad está activo. */
export const MASKED_MONEY = "$ ••••••";

// Última preferencia conocida en este navegador. Solo sirve para NO mostrar
// montos durante el instante en que el perfil aún está cargando.
// La fuente de verdad sigue siendo Firestore (users/{uid}.privacyModeEnabled).
const HINT_KEY = "pinak.privacyMode";

export async function setPrivacyMode(userId: string, enabled: boolean) {
  await updateDoc(doc(db, "users", userId), { privacyModeEnabled: enabled });
}

/**
 * Modo privacidad (exclusivo del plan Premium).
 *  - available: el plan del usuario incluye la función.
 *  - enabled:   la función está disponible Y activada.
 *  - money(n):  formatea un monto en COP, o lo oculta si enabled.
 *  - toggle():  activa/desactiva y guarda la preferencia en Firestore.
 */
export function usePrivacy() {
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const { business } = useBusiness();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    try {
      setHint(localStorage.getItem(HINT_KEY) === "1");
    } catch {
      /* localStorage no disponible: se ignora */
    }
  }, []);

  // La disponibilidad sigue al plan del negocio que se está viendo (el de su dueño);
  // mientras carga, se usa el plan propio de la cuenta.
  const plan = business?.plan ?? profile?.plan;
  const available = plan ? PLAN_LIMITS[plan].privacyMode : false;
  // Si el usuario bajó de Premium, la función deja de aplicarse sola.
  const enabled = profile ? available && profile.privacyModeEnabled : hint;

  useEffect(() => {
    if (!profile) return;
    try {
      localStorage.setItem(HINT_KEY, available && profile.privacyModeEnabled ? "1" : "0");
    } catch {
      /* se ignora */
    }
  }, [profile, available]);

  const toggle = useCallback(async () => {
    if (!user || !available) return;
    await setPrivacyMode(user.uid, !enabled);
  }, [user, available, enabled]);

  const money = useCallback(
    (value: number) => (enabled ? MASKED_MONEY : currency.format(value)),
    [enabled]
  );

  return { available, enabled, toggle, money };
}
