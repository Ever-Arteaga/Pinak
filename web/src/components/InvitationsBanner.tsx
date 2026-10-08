"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendEmailVerification } from "firebase/auth";
import { useAuthUser } from "@/lib/auth";
import { useBusiness, useMyInvitations } from "@/lib/business";
import { acceptInvite, declineInvite } from "@/lib/businessApi";

/** Invitaciones a otros negocios que la persona puede aceptar o rechazar. */
export function InvitationsBanner() {
  const router = useRouter();
  const { user } = useAuthUser();
  const { switchBusiness } = useBusiness();
  const invitations = useMyInvitations(user?.email, user?.emailVerified === true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function handleAccept(inviteId: string) {
    setBusyId(inviteId);
    setError(null);
    try {
      const { businessId } = await acceptInvite({ inviteId });
      switchBusiness(businessId);
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(inviteId: string) {
    setBusyId(inviteId);
    setError(null);
    try {
      await declineInvite({ inviteId });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-4 flex flex-col gap-3">
      {invitations.map((inv) => (
        <div key={inv.id} className="rounded-2xl border border-green-600/30 bg-green-100 p-4">
          <p className="text-sm text-navy-900">
            <strong>{inv.invitedByEmail || "Alguien"}</strong> te invitó a unirte a{" "}
            <strong>{inv.businessName}</strong>.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleAccept(inv.id)}
              disabled={busyId === inv.id}
              className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
            >
              Aceptar
            </button>
            <button
              onClick={() => handleDecline(inv.id)}
              disabled={busyId === inv.id}
              className="rounded-lg border border-line bg-white px-4 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream disabled:opacity-60"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

/**
 * Las invitaciones solo se muestran con el correo verificado (así nadie puede
 * apropiarse de la invitación de otra persona). Esta tarjeta ayuda a verificarlo.
 */
export function VerifyEmailCard() {
  const { user } = useAuthUser();
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  async function handleSend() {
    setError(null);
    try {
      await sendEmailVerification(user!);
      setSent(true);
    } catch {
      setError("No se pudo enviar el correo. Intenta de nuevo en unos minutos.");
    }
  }

  async function handleChecked() {
    setChecking(true);
    setError(null);
    try {
      await user!.reload();
      await user!.getIdToken(true); // refresca la sesión para que el servidor vea el correo verificado
      force((n) => n + 1);
      if (!user!.emailVerified) setError("Todavía no aparece como verificado. Abre el enlace del correo y vuelve a intentar.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-line bg-white p-4">
      <h2 className="font-display text-sm font-semibold text-navy-900">Verifica tu correo</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Para recibir invitaciones a otros negocios necesitamos confirmar que <strong>{user.email}</strong> es
        tuyo.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleSend}
          className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-cream"
        >
          {sent ? "Enviar de nuevo" : "Enviar correo de verificación"}
        </button>
        <button
          onClick={handleChecked}
          disabled={checking}
          className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
        >
          Ya lo verifiqué
        </button>
      </div>
      {sent && <p className="mt-2 text-xs text-green-600">Te enviamos el correo. Revisa también la carpeta de spam.</p>}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}
