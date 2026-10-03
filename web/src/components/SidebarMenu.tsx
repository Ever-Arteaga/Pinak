"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser } from "@/lib/auth";
import { usePrivacy } from "@/lib/privacy";
import { PinakWordmark } from "./PinakLogo";
import { EyeOffIcon } from "./PrivacyIcons";
import { InstallAppButton } from "./InstallAppButton";

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={2} />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={2} />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={2} />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

function FiadosIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth={2} />
      <path
        d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3M20 20c0-2.8-2-5-4.5-5.7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReportesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 20V10M12 20V4M19 20v-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlanesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 7.1 18.2l.9-5.5-4-3.9L9.5 8 12 3z"
        stroke="currentColor"
        strokeWidth={2}
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

const ENLACES = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/fiados", label: "Fiados", icon: FiadosIcon },
  { href: "/reportes", label: "Reportes", icon: ReportesIcon },
  { href: "/upgrade", label: "Planes", icon: PlanesIcon },
];

export function SidebarMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { available: privacyAvailable, enabled: privacyEnabled, toggle: togglePrivacy } =
    usePrivacy();

  // Cierra con la tecla Escape
  useEffect(() => {
    function alPresionarTecla(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", alPresionarTecla);
    return () => document.removeEventListener("keydown", alPresionarTecla);
  }, [onClose]);

  // Bloquea el scroll del fondo mientras el menú está abierto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleLogout() {
    onClose();
    await logoutUser();
    router.push("/");
  }

  return (
    <>
      {/* Fondo oscuro, cierra el menú al hacer clic afuera */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-navy-900/40 transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <PinakWordmark />
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-ink-soft transition hover:bg-cream hover:text-navy-900"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {ENLACES.map((enlace) => {
            const activo = pathname === enlace.href;
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  activo
                    ? "bg-green-100 text-navy-900"
                    : "text-ink-soft hover:bg-cream hover:text-navy-900"
                }`}
              >
                <enlace.icon />
                {enlace.label}
              </Link>
            );
          })}
        </nav>

        <InstallAppButton />

        {/* Modo privacidad: interruptor para Premium, invitación a mejorar para los demás */}
        <div className="border-t border-line px-3 py-3">
          {privacyAvailable ? (
            <button
              onClick={() => togglePrivacy()}
              role="switch"
              aria-checked={privacyEnabled}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-cream hover:text-navy-900"
            >
              <span className="flex items-center gap-3">
                <EyeOffIcon />
                Modo privacidad
              </span>
              <span
                aria-hidden="true"
                className={`relative h-5 w-9 rounded-full transition ${
                  privacyEnabled ? "bg-green-600" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    privacyEnabled ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          ) : (
            <Link
              href="/upgrade"
              onClick={onClose}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-cream hover:text-navy-900"
            >
              <span className="flex items-center gap-3">
                <EyeOffIcon />
                Modo privacidad
              </span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-navy-900">
                Premium
              </span>
            </Link>
          )}
        </div>

        <div className="border-t border-line px-3 py-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger transition hover:bg-red-50"
          >
            <LogoutIcon />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
