"use client";

import Link from "next/link";
import { PinakWordmark } from "./PinakLogo";

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppHeader({
  backHref,
  backLabel = "Atrás",
  title,
  onLogout,
}: {
  backHref?: string;
  backLabel?: string;
  title?: string;
  onLogout?: () => void;
}) {
  return (
    <header className="relative flex items-center justify-between border-b border-line bg-white px-5 py-4">
      {backHref ? (
        <Link
          href={backHref}
          className="flex items-center gap-1.5 rounded-lg py-1.5 pl-1 pr-3 text-sm font-medium text-ink-soft transition hover:bg-cream hover:text-navy-900"
        >
          <BackIcon />
          {backLabel}
        </Link>
      ) : (
        <PinakWordmark />
      )}

      {title && (
        <span className="font-display absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-navy-900">
          {title}
        </span>
      )}

      {onLogout && (
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg py-1.5 px-3 text-sm font-medium text-ink-soft transition hover:bg-red-50 hover:text-danger"
        >
          <LogoutIcon />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      )}
    </header>
  );
}
