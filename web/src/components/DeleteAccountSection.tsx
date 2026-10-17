"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logoutUser, reauthenticate, reauthMethod, useAuthUser } from "@/lib/auth";
import { deleteAccount } from "@/lib/businessApi";

/** Zona de peligro de Mi perfil: elimina la cuenta y todos sus datos (doble confirmación). */
export function DeleteAccountSection() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const method = reauthMethod(user);
  const ready = phrase.trim().toUpperCase() === "ELIMINAR" && (method === "google" || password.length > 0);

  const close = () => {
    setOpen(false);
    setPhrase("");
    setPassword("");
    setError(null);
  };

  const confirmar = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reauthenticate(user, password);
      await deleteAccount({ confirmation: phrase });
      await logoutUser().catch(() => {});
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-red-200 bg-white p-5">
      <h2 className="font-display text-sm font-semibold text-danger">Eliminar cuenta</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Borra para siempre tu cuenta y tus negocios, con sus movimientos, fiados y categorías. Las
        personas de tu equipo perderán el acceso. No se puede deshacer y no hay reembolso del plan.
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-red-50"
        >
          Eliminar mi cuenta
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-phrase" className="text-sm font-medium text-ink">
              Escribe <span className="font-semibold">ELIMINAR</span> para confirmar
            </label>
            <input
              id="delete-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
            />
          </div>
          {method === "password" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="delete-password" className="text-sm font-medium text-ink">
                Tu contraseña
              </label>
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
              />
            </div>
          ) : (
            <p className="text-xs text-ink-soft">Se abrirá Google para confirmar que eres tú.</p>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={confirmar}
              disabled={!ready || busy}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Eliminando..." : "Eliminar definitivamente"}
            </button>
            <button
              onClick={close}
              disabled={busy}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-cream disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
