"use client";

import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Plan } from "@/types/pinak";

export interface UserProfileData {
  email: string;
  businessName: string;
  businessType: string;
  phone: string;
  city: string;
  nit: string;
  description: string;
  plan: Plan;
  privacyModeEnabled: boolean;
  createdAt: Date | null;
}

/** Hook en tiempo real con el perfil del negocio del usuario (incluye el plan actual). */
export function useUserProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", userId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data();
      setProfile(
        data
          ? {
              email: data.email ?? "",
              businessName: data.businessName ?? "",
              businessType: data.businessType ?? "",
              phone: data.phone ?? "",
              city: data.city ?? "",
              nit: data.nit ?? "",
              description: data.description ?? "",
              plan: (data.plan as Plan) ?? "emprendedor",
              privacyModeEnabled: data.privacyModeEnabled === true,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            }
          : null
      );
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  return { profile, loading };
}

/** Actualiza los datos editables del perfil de la empresa (nunca el plan: lo bloquean las reglas de Firestore). */
export async function updateBusinessProfile(
  userId: string,
  datos: {
    businessName: string;
    businessType: string;
    phone: string;
    city: string;
    nit: string;
    description: string;
  }
) {
  const ref = doc(db, "users", userId);
  await updateDoc(ref, { ...datos });
}
