"use client";

import { collection, deleteDoc, doc, runTransaction, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useBusinessCollection } from "./collections";
import type { Quote, QuoteItem, QuoteStatus } from "@/types/pinak";

const pad = (n: number) => String(n).padStart(6, "0");

/** Número como se muestra: "COT-000012". */
export function quoteNumber(q: Pick<Quote, "number">): string {
  return `COT-${pad(q.number)}`;
}

export function quoteTotal(items: QuoteItem[]): number {
  return items.reduce((s, i) => s + Math.round(i.qty * i.price), 0);
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export interface NewQuoteInput {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerDocument?: string;
  items: QuoteItem[];
  /** Hasta cuándo vale la oferta. */
  validUntil: Date;
  notes?: string;
}

/** Crea la cotización con el siguiente consecutivo (todo o nada). */
export async function createQuote(businessId: string, input: NewQuoteInput): Promise<Quote> {
  const uid = auth.currentUser?.uid ?? "";
  const base = ["businesses", businessId] as const;
  const counterRef = doc(db, ...base, "meta", "counters");
  const quoteRef = doc(collection(db, ...base, "quotes"));

  const items = input.items.map((i) => ({ name: i.name.trim(), qty: i.qty, price: i.price }));
  const total = quoteTotal(items);
  const now = new Date();
  const customerName = input.customerName.trim() || "Cliente general";

  const number = await runTransaction(db, async (t) => {
    const snap = await t.get(counterRef);
    const counters: Record<string, unknown> = snap.exists() ? { ...snap.data() } : {};
    const next = (typeof counters.quote === "number" ? counters.quote : 0) + 1;
    counters.quote = next;
    t.set(counterRef, counters);
    t.set(quoteRef, {
      number: next,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      customerName,
      customerPhone: (input.customerPhone ?? "").trim(),
      customerDocument: (input.customerDocument ?? "").trim(),
      items,
      total,
      status: "pendiente",
      validUntil: Timestamp.fromDate(input.validUntil),
      notes: (input.notes ?? "").trim(),
      date: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: uid,
    });
    return next;
  });

  return {
    id: quoteRef.id,
    number,
    customerId: input.customerId,
    customerName,
    customerPhone: input.customerPhone?.trim() || undefined,
    customerDocument: input.customerDocument?.trim() || undefined,
    items,
    total,
    status: "pendiente",
    validUntil: input.validUntil,
    notes: input.notes?.trim() || undefined,
    date: now,
    createdAt: now,
  };
}

export async function setQuoteStatus(businessId: string, id: string, status: QuoteStatus, receiptId?: string) {
  await updateDoc(doc(db, "businesses", businessId, "quotes", id), {
    status,
    ...(receiptId ? { receiptId } : {}),
  });
}

export async function deleteQuote(businessId: string, id: string) {
  await deleteDoc(doc(db, "businesses", businessId, "quotes", id));
}

export function useQuotes(businessId: string | undefined) {
  return useBusinessCollection<Quote>(businessId, "quotes", "number", "desc", (d) => {
    const x = d.data();
    return {
      id: d.id,
      number: Number(x.number) || 0,
      customerId: x.customerId,
      customerName: x.customerName ?? "Cliente general",
      customerPhone: x.customerPhone || undefined,
      customerDocument: x.customerDocument || undefined,
      items: Array.isArray(x.items) ? (x.items as QuoteItem[]) : [],
      total: Number(x.total) || 0,
      status: x.status === "aceptada" || x.status === "rechazada" ? x.status : "pendiente",
      validUntil: x.validUntil?.toDate?.() ?? new Date(),
      notes: x.notes || undefined,
      receiptId: typeof x.receiptId === "string" ? x.receiptId : undefined,
      date: x.date?.toDate?.() ?? new Date(),
      createdAt: x.createdAt?.toDate?.() ?? new Date(),
    };
  });
}
