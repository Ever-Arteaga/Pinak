"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Plan } from "@/types/pinak";

interface UserProfileData {
  businessName: string;
  plan: Plan;
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
              businessName: data.businessName ?? "",
              plan: (data.plan as Plan) ?? "emprendedor",
            }
          : null
      );
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  return { profile, loading };
}
