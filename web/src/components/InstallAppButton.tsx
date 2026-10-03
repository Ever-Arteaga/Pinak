"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/lib/pwa";

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Botón "Instalar app" del menú lateral. No aparece si la app ya está instalada. */
export function InstallAppButton() {
  const { canInstall, showIosHelp, install } = useInstallPrompt();
  const [help, setHelp] = useState(false);

  if (!canInstall && !showIosHelp) return null;

  return (
    <div className="border-t border-line px-3 py-3">
      <button
        onClick={() => (canInstall ? install() : setHelp((v) => !v))}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-cream hover:text-navy-900"
      >
        <DownloadIcon />
        Instalar app
      </button>
      {help && (
        <p className="mx-3 mt-1 rounded-lg bg-cream px-3 py-2 text-xs leading-relaxed text-ink-soft">
          En Safari toca el botón <strong>Compartir</strong> y luego{" "}
          <strong>Añadir a pantalla de inicio</strong>.
        </p>
      )}
    </div>
  );
}
