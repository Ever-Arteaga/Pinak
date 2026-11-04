"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";

/** Escucha en tiempo real una subcolección del negocio, ordenada por un campo. */
export function useBusinessCollection<T>(
  businessId: string | undefined,
  name: string,
  orderField: string,
  direction: "asc" | "desc",
  parse: (d: QueryDocumentSnapshot<DocumentData>) => T
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!businessId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setError(null);
    const q = query(collection(db, "businesses", businessId, name), orderBy(orderField, direction));
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map(parse));
        setLoading(false);
      },
      (err) => {
        console.error(`No se pudo cargar ${name}:`, err);
        setError("No pudimos cargar tus datos. Revisa tu conexión e intenta de nuevo.");
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, name, orderField, direction, attempt]);

  return {
    items,
    loading,
    error,
    retry: () => {
      setLoading(true);
      setAttempt((n) => n + 1);
    },
  };
}
