"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/auth";
import { useBusiness, useSentInvitations } from "@/lib/business";
import { cancelInvite, inviteMember, removeMember } from "@/lib/businessApi";
import { useBusinessGate } from "@/components/BusinessGate";
import { AppHeader } from "@/components/AppHeader";
import { PLAN_LIMITS, PLAN_NAMES } from "@/types/pinak";

export default function EquipoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { business, businesses, isOwner, switchBusiness } = useBusiness();
  const sent = useSentInvitations(business?.id, user?.uid);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  const limit = PLAN_LIMITS[biz.plan].users;
  const limitText = Number.isFinite(limit) ? String(limit) : "ilimitados";
  const used = biz.members.length + sent.length;
  const full = Number.isFinite(limit) && used >= limit;

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await inviteMember({ businessId: biz.id, email });
      setInfo(`Invitación enviada a ${email.trim().toLowerCase()}.`);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(uid: string, label: string) {
    if (!window.confirm(`¿Quitar a ${label} de este negocio?`)) return;
    setError(null);
    try {
      await removeMember({ businessId: biz.id, memberUid: uid });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleLeave() {
    if (!window.confirm(`¿Salir de ${biz.name}? Dejarás de ver sus datos.`)) return;
    setError(null);
    try {
      await removeMember({ businessId: biz.id, memberUid: user!.uid });
      const own = businesses.find((b) => b.ownerId === user!.uid);
      if (own) switchBusiness(own.id);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCancel(inviteId: string) {
    setError(null);
    try {
      await cancelInvite({ inviteId });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-cream pb-24">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Equipo" />

      <div className="mx-auto max-w-md px-5 pt-6">
        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-sm font-semibold text-navy-900">
              Personas en {biz.name}
            </h1>
            <p className="text-xs text-ink-soft">
              {biz.members.length} de {limitText}
            </p>
          </div>

          <ul className="mt-3 divide-y divide-line">
            {biz.members.map((m) => (
              <li key={m.uid} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {m.email || "Sin correo"}
                    {m.uid === user?.uid && <span className="text-ink-soft"> (tú)</span>}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {m.role === "owner" ? "Dueño" : "Miembro"}
                  </p>
                </div>
                {isOwner && m.role !== "owner" && (
                  <button
                    onClick={() => handleRemove(m.uid, m.email || "esta persona")}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-red-50"
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!isOwner && (
            <button
              onClick={handleLeave}
              className="mt-3 w-full rounded-lg border border-line py-2.5 text-sm font-semibold text-danger transition hover:bg-red-50"
            >
              Salir de este negocio
            </button>
          )}
        </section>

        {sent.length > 0 && (
          <section className="mt-4 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900">
              Invitaciones pendientes
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {sent.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="truncate text-sm text-ink">{inv.email}</p>
                  {isOwner && (
                    <button
                      onClick={() => handleCancel(inv.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-cream"
                    >
                      Cancelar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isOwner && (
          <section className="mt-4 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900">Invitar a alguien</h2>

            {biz.plan === "emprendedor" ? (
              <div className="mt-3">
                <p className="text-sm text-ink-soft">
                  El plan {PLAN_NAMES.emprendedor} incluye 1 usuario. Con Pro puedes sumar a una
                  persona más, y con Premium a todas las que necesites.
                </p>
                <Link
                  href="/upgrade"
                  className="mt-3 inline-block rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800"
                >
                  Ver planes
                </Link>
              </div>
            ) : full ? (
              <p className="mt-3 text-sm text-ink-soft">
                Ya usaste todos los cupos de tu plan {PLAN_NAMES[biz.plan]} ({limitText} usuarios,
                contándote a ti).{" "}
                {biz.plan === "pro" && (
                  <>
                    Con{" "}
                    <Link href="/upgrade" className="font-semibold text-navy-900 underline">
                      Premium
                    </Link>{" "}
                    no hay límite.
                  </>
                )}
              </p>
            ) : (
              <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="inviteEmail" className="text-sm font-medium text-ink">
                    Correo de la persona
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@correo.com"
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
                >
                  {busy ? "Enviando..." : "Enviar invitación"}
                </button>
                <p className="text-xs text-ink-soft">
                  No enviamos correos de invitación: avísale a la persona. Debe crear su cuenta (o
                  iniciar sesión) con <strong>ese mismo correo</strong>, verificarlo y aceptar la
                  invitación que le aparecerá en su panel.
                </p>
              </form>
            )}
          </section>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
        {info && <p className="mt-4 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-600">{info}</p>}
      </div>
    </main>
  );
}
