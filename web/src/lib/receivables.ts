"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Receivable } from "@/types/pinak";

interface NewReceivableInput {
  clientName: string;
  clientPhone?: string;
  amount: number;
  dueDate?: Date;
}

export async function addReceivable(businessId: string, input: NewReceivableInput) {
  const ref = collection(db, "businesses", businessId, "receivables");
  await addDoc(ref, {
    clientName: input.clientName,
    clientPhone: input.clientPhone ?? "",
    amount: input.amount,
    status: "pendiente",
    dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
    createdAt: serverTimestamp(),
  });
}

export async function markReceivableAsPaid(businessId: string, receivableId: string) {
  await updateDoc(doc(db, "businesses", businessId, "receivables", receivableId), {
    status: "pagado",
  });
}

export async function updateReceivable(
  businessId: string,
  receivableId: string,
  input: NewReceivableInput
) {
  await updateDoc(doc(db, "businesses", businessId, "receivables", receivableId), {
    clientName: input.clientName,
    clientPhone: input.clientPhone ?? "",
    amount: input.amount,
    ...(input.dueDate ? { dueDate: Timestamp.fromDate(input.dueDate) } : {}),
  });
}

export async function deleteReceivable(businessId: string, receivableId: string) {
  await deleteDoc(doc(db, "businesses", businessId, "receivables", receivableId));
}

export function useReceivables(businessId: string | undefined) {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setReceivables([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "businesses", businessId, "receivables"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          clientName: data.clientName,
          clientPhone: data.clientPhone,
          amount: data.amount,
          status: data.status,
          dueDate: data.dueDate?.toDate?.() ?? undefined,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        } as Receivable;
      });
      setReceivables(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [businessId]);

  return { receivables, loading };
}

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function buildWhatsAppCollectionLink(
  businessName: string,
  receivable: Receivable
): string {
  const monto = currency.format(receivable.amount);
  const mensaje =
    `¡Hola ${receivable.clientName}! 👋 Te escribo de ${businessName} para recordarte ` +
    `tu saldo pendiente de ${monto}. Puedes pagarlo fácilmente por Neui o PSE ` +
    `cuando gustes. ¡Gracias por tu confianza! 🙌`;

  const phone = normalizePhoneNumber(receivable.clientPhone);
  const encoded = encodeURIComponent(mensaje);

  return phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

function normalizePhoneNumber(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}
