"use client";

import { useEffect } from "react";
import "@/lib/pwa"; // empieza a escuchar el aviso de "instalable" desde el primer momento

/** Registra el service worker (solo en producción) para que la app sea instalable. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* si falla, la app sigue funcionando normal, solo no será instalable */
    });
  }, []);

  return null;
}
