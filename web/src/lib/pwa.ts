"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// El navegador avisa UNA sola vez que la app se puede instalar. Se captura a
// nivel de módulo (no de componente) para no perder el aviso al cambiar de página.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * - canInstall:   el navegador permite instalar con un toque (Chrome, Edge, Android).
 * - showIosHelp:  iPhone/iPad (Safari no tiene botón automático): mostrar instrucciones.
 * - install():    abre el cuadro de instalación del navegador.
 * Si la app ya está instalada, ambos son false.
 */
export function useInstallPrompt() {
  const [, force] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    const evt = deferredPrompt;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") setInstalled(true);
    notify();
  }, []);

  return {
    canInstall: !installed && deferredPrompt !== null,
    showIosHelp: !installed && ios && deferredPrompt === null,
    install,
  };
}
