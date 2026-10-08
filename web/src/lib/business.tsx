"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { db } from "./firebase";
import { isAuthBootstrapping, useAuthUser } from "./auth";
import { ensureBusiness } from "./businessApi";
import { pickActiveBusiness, sortBusinesses } from "./businessSelect";
import type { Business, BusinessMember, Invitation, Plan } from "@/types/pinak";

const storageKey = (uid: string) => `pinak.activeBusiness.${uid}`;

function normalizePlan(v: unknown): Plan {
  return v === "pro" || v === "premium" ? v : "emprendedor";
}

function parseBusiness(d: QueryDocumentSnapshot): Business {
  const x = d.data();
  const rawMembers = (x.members ?? {}) as Record<
    string,
    { role?: string; email?: string; joinedAt?: { toDate?: () => Date } }
  >;
  const members: BusinessMember[] = Object.entries(rawMembers)
    .map(([uid, m]) => ({
      uid,
      role: (m.role === "owner" ? "owner" : "member") as BusinessMember["role"],
      email: m.email ?? "",
      joinedAt: m.joinedAt?.toDate ? m.joinedAt.toDate() : null,
    }))
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));

  return {
    id: d.id,
    name: x.name ?? "Mi negocio",
    businessType: x.businessType ?? "",
    phone: x.phone ?? "",
    city: x.city ?? "",
    nit: x.nit ?? "",
    description: x.description ?? "",
    ownerId: x.ownerId ?? "",
    plan: normalizePlan(x.plan),
    locked: x.locked === true,
    members,
    createdAt: x.createdAt?.toDate ? x.createdAt.toDate() : null,
  };
}

interface BusinessContextValue {
  /** Cargando la sesión o los negocios. */
  loading: boolean;
  /** Si no se pudo preparar el negocio (red, funciones sin desplegar...). */
  error: string | null;
  retry: () => void;
  /** Negocio que se está viendo. */
  business: Business | null;
  /** Todos los negocios a los que pertenece la persona (propios y compartidos). */
  businesses: Business[];
  /** true si la persona es la dueña del negocio activo. */
  isOwner: boolean;
  switchBusiness: (id: string) => void;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuthUser();
  const uid = user?.uid ?? null;

  const [rawBusinesses, setRawBusinesses] = useState<Business[]>([]);
  const [ready, setReady] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedId, setStoredId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tick, setTick] = useState(0);
  const ensuredFor = useRef<string | null>(null);

  // Escucha en tiempo real los negocios de la persona.
  useEffect(() => {
    setRawBusinesses([]);
    setReady(false);
    setError(null);
    setEnsuring(false);
    ensuredFor.current = null;

    if (!uid) {
      setStoredId(null);
      return;
    }
    try {
      setStoredId(localStorage.getItem(storageKey(uid)));
    } catch {
      /* sin localStorage: se usa el primer negocio */
    }

    const q = query(collection(db, "businesses"), where("memberIds", "array-contains", uid));
    return onSnapshot(
      q,
      (snap) => {
        setRawBusinesses(snap.docs.map(parseBusiness));
        setReady(true);
      },
      () => {
        setError("No se pudo cargar tu negocio. Revisa tu conexión e intenta de nuevo.");
        setReady(true);
      }
    );
  }, [uid, attempt]);

  // Cuenta nueva, o anterior a los equipos: se crea (o migra) su primer negocio.
  useEffect(() => {
    if (!uid || !ready || rawBusinesses.length > 0 || ensuredFor.current === uid || error) return;

    // Durante el registro, el propio registro crea el negocio con el nombre correcto.
    if (isAuthBootstrapping()) {
      const t = setTimeout(() => setTick((n) => n + 1), 1200);
      return () => clearTimeout(t);
    }

    ensuredFor.current = uid;
    setEnsuring(true);
    ensureBusiness({})
      .catch((e: Error) => setError(e.message))
      .finally(() => setEnsuring(false));
  }, [uid, ready, rawBusinesses.length, error, tick]);

  const businesses = useMemo(() => sortBusinesses(rawBusinesses, uid), [rawBusinesses, uid]);
  const business = useMemo(
    () => pickActiveBusiness(businesses, storedId, uid),
    [businesses, storedId, uid]
  );

  const switchBusiness = useCallback(
    (id: string) => {
      setStoredId(id);
      if (!uid) return;
      try {
        localStorage.setItem(storageKey(uid), id);
      } catch {
        /* se ignora */
      }
    },
    [uid]
  );

  const retry = useCallback(() => {
    ensuredFor.current = null;
    setAttempt((n) => n + 1);
  }, []);

  const loading = authLoading || (!!uid && (!ready || (rawBusinesses.length === 0 && !error)));

  const value = useMemo<BusinessContextValue>(
    () => ({
      loading: loading || ensuring,
      error,
      retry,
      business,
      businesses,
      isOwner: !!business && business.ownerId === uid,
      switchBusiness,
    }),
    [loading, ensuring, error, retry, business, businesses, uid, switchBusiness]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness debe usarse dentro de <BusinessProvider>.");
  return ctx;
}

/** Edita los datos descriptivos del negocio (solo el dueño; lo exigen las reglas). */
export async function updateBusinessProfile(
  businessId: string,
  datos: {
    name: string;
    businessType: string;
    phone: string;
    city: string;
    nit: string;
    description: string;
  }
) {
  await updateDoc(doc(db, "businesses", businessId), { ...datos });
}

// ---------------------------------------------------------------------------
// Invitaciones
// ---------------------------------------------------------------------------
function parseInvitation(d: QueryDocumentSnapshot): Invitation {
  const x = d.data();
  return {
    id: d.id,
    businessId: x.businessId ?? "",
    businessName: x.businessName ?? "",
    email: x.email ?? "",
    invitedByEmail: x.invitedByEmail ?? "",
    status: x.status ?? "pendiente",
  };
}

/** Invitaciones pendientes dirigidas a la persona (solo se ven con el correo verificado). */
export function useMyInvitations(email: string | null | undefined, verified: boolean) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!email || !verified) {
      setInvitations([]);
      return;
    }
    const q = query(
      collection(db, "invitations"),
      where("email", "==", email.toLowerCase()),
      where("status", "==", "pendiente")
    );
    return onSnapshot(
      q,
      (snap) => setInvitations(snap.docs.map(parseInvitation)),
      () => setInvitations([])
    );
  }, [email, verified]);

  return invitations;
}

/** Invitaciones pendientes que envió el dueño para un negocio. */
export function useSentInvitations(businessId: string | undefined, uid: string | undefined) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!businessId || !uid) {
      setInvitations([]);
      return;
    }
    const q = query(
      collection(db, "invitations"),
      where("invitedByUid", "==", uid),
      where("businessId", "==", businessId),
      where("status", "==", "pendiente")
    );
    return onSnapshot(
      q,
      (snap) => setInvitations(snap.docs.map(parseInvitation)),
      () => setInvitations([])
    );
  }, [businessId, uid]);

  return invitations;
}
