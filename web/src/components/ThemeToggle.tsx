"use client";

import { useTheme } from "@/lib/theme";

/** Botón para cambiar entre modo claro y oscuro. */
export function ThemeToggle({ className = "", withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex items-center gap-3 rounded-lg text-sm font-medium transition ${className}`}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={2} />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        </svg>
      )}
      {withLabel && (dark ? "Modo claro" : "Modo oscuro")}
    </button>
  );
}
