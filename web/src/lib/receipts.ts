"use client";

import { collection, doc, runTransaction, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useBusinessCollection } from "./collections";
import {
  billingProblems,
  docTotals,
  formatDocNumber,
  type BillingConfig,
  type DocType,
} from "@pinak/shared/billing";
import type { PaymentMethod, Receipt, ReceiptFiscal, ReceiptItem } from "@/types/pinak";

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export interface NewReceiptInput {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerDocument?: string;
  items: ReceiptItem[];
  method: PaymentMethod;
  status: "pagado" | "pendiente";
  /** Solo si queda pendiente: fecha límite de pago (el plazo del crédito). */
  dueDate?: Date | null;
  notes?: string;
  /** Todo lo vendido son servicios: el ingreso se registra en la categoría "Servicios". */
  onlyServices?: boolean;
  /** Si el recibo cobra una cita, se marca como atendida y pagada en la misma operación. */
  appointmentId?: string;
  /** "factura" usa la numeración autorizada por la DIAN (requiere `billing`); por defecto es un recibo interno. */
  docType?: DocType;
  billing?: BillingConfig;
}

export function receiptTotal(items: ReceiptItem[]): number {
  return docTotals(items).total;
}

/**
 * Crea el documento con el siguiente consecutivo y, en la misma operación:
 * - si está pagado, registra el ingreso en los movimientos;
 * - si queda pendiente, lo registra como fiado del cliente.
 * Todo se guarda junto o no se guarda nada.
 */
export async function createReceipt(businessId: string, input: NewReceiptInput): Promise<Receipt> {
  const uid = auth.currentUser?.uid ?? "";
  const base = ["businesses", businessId] as const;
  const counterRef = doc(db, ...base, "meta", "counters");
  const receiptRef = doc(collection(db, ...base, "receipts"));
  const txRef = doc(collection(db, ...base, "transactions"));
  const recvRef = doc(collection(db, ...base, "receivables"));
  const apptRef = input.appointmentId ? doc(db, ...base, "appointments", input.appointmentId) : null;

  const isInvoice = input.docType === "factura";
  const billing = input.billing;
  if (isInvoice && !billing) throw new Error("Configura los datos de facturación en tu perfil.");

  const items: ReceiptItem[] = input.items.map((i) => ({
    name: i.name.trim(),
    qty: i.qty,
    price: i.price,
    ...(isInvoice ? { unit: (i.unit ?? "UND").trim() || "UND", ivaRate: i.ivaRate ?? 0 } : {}),
  }));
  const totals = docTotals(isInvoice ? items : items.map((i) => ({ ...i, ivaRate: 0 })));
  const total = totals.total;
  const customerName = input.customerName.trim() || (isInvoice ? "Consumidor final" : "Cliente general");
  const customerDocument = (input.customerDocument ?? "").trim() || (isInvoice ? "222222222222" : "");
  const now = new Date();
  const dueDate = input.status === "pendiente" ? input.dueDate ?? null : null;
  const fiscal: ReceiptFiscal | undefined =
    isInvoice && billing
      ? {
          resolutionNumber: billing.resolutionNumber,
          resolutionDate: billing.resolutionDate,
          prefix: billing.prefix,
          rangeFrom: billing.rangeFrom,
          rangeTo: billing.rangeTo,
          validUntil: billing.validUntil,
          taxStatus: billing.taxStatus,
          taxNote: billing.taxNote,
        }
      : undefined;
  const key = billing ? `${billing.prefix}|${billing.resolutionNumber}` : "";

  const number = await runTransaction(db, async (t) => {
    const snap = await t.get(counterRef);
    const counters: Record<string, unknown> = snap.exists() ? { ...snap.data() } : {};
    let next: number;
    if (isInvoice && billing) {
      // Facturas: consecutivo propio dentro del rango autorizado de la resolución vigente.
      const sameKey = counters.invoiceKey === key && typeof counters.invoice === "number";
      next = sameKey ? (counters.invoice as number) + 1 : billing.rangeFrom;
      const problems = billingProblems(billing, next);
      if (problems.length > 0) throw new Error(problems[0]);
      counters.invoice = next;
      counters.invoiceKey = key;
    } else {
      next = (typeof counters.receipt === "number" ? counters.receipt : 0) + 1;
      counters.receipt = next;
    }
    t.set(counterRef, counters);

    t.set(receiptRef, {
      number: next,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      customerName,
      customerPhone: (input.customerPhone ?? "").trim(),
      customerDocument,
      items,
      total,
      method: input.method,
      status: input.status,
      notes: (input.notes ?? "").trim(),
      date: Timestamp.fromDate(now),
      createdAt: serverTimestamp(),
      createdBy: uid,
      ...(isInvoice && billing && fiscal
        ? {
            docType: "factura",
            prefix: billing.prefix,
            subtotal: totals.subtotal,
            ivaTotal: totals.ivaTotal,
            fiscal,
            ...(dueDate ? { dueDate: Timestamp.fromDate(dueDate) } : {}),
          }
        : { docType: "recibo" }),
      ...(input.status === "pagado" ? { transactionId: txRef.id } : { receivableId: recvRef.id }),
    });

    const label = formatDocNumber(next, isInvoice ? billing?.prefix : undefined);
    if (input.status === "pagado") {
      t.set(txRef, {
        type: "ingreso",
        // En la contabilidad del negocio el IVA cobrado no es ingreso propio: se registra el valor de la venta sin IVA.
        amount: isInvoice ? Math.max(totals.subtotal, 1) : total,
        category: input.onlyServices ? "Servicios" : "Ventas",
        method: input.method,
        description: `${isInvoice ? "Factura" : "Recibo"} ${label} · ${customerName}`.slice(0, 200),
        date: serverTimestamp(),
        source: "manual",
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
    } else {
      t.set(recvRef, {
        clientName: customerName,
        clientPhone: (input.customerPhone ?? "").trim(),
        amount: total,
        status: "pendiente",
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
    }
    if (apptRef) {
      t.update(apptRef, {
        status: "atendida",
        paid: input.status === "pagado",
        receiptId: receiptRef.id,
      });
    }
    return next;
  });

  return {
    id: receiptRef.id,
    number,
    customerId: input.customerId,
    customerName,
    customerPhone: input.customerPhone?.trim() || undefined,
    customerDocument: customerDocument || undefined,
    items,
    total,
    method: input.method,
    status: input.status,
    notes: input.notes?.trim() || undefined,
    date: now,
    createdAt: now,
    docType: isInvoice ? "factura" : "recibo",
    prefix: isInvoice ? billing?.prefix : undefined,
    subtotal: isInvoice ? totals.subtotal : undefined,
    ivaTotal: isInvoice ? totals.ivaTotal : undefined,
    dueDate: dueDate ?? undefined,
    fiscal,
  };
}

/** Número como se muestra: "000012" para recibos, "FV-000012" para facturas con prefijo. */
export function receiptNumber(r: Pick<Receipt, "number" | "prefix">): string {
  return formatDocNumber(r.number, r.prefix);
}

/** Etiqueta corta del documento: "Factura FV-000012" o "Recibo No. 000012". */
export function receiptLabel(r: Pick<Receipt, "number" | "prefix" | "docType">): string {
  return r.docType === "factura" ? `Factura ${receiptNumber(r)}` : `Recibo No. ${receiptNumber(r)}`;
}

export function pad(n: number): string {
  return String(n).padStart(6, "0");
}

export function useReceipts(businessId: string | undefined) {
  return useBusinessCollection<Receipt>(businessId, "receipts", "number", "desc", (d) => {
    const x = d.data();
    return {
      id: d.id,
      number: Number(x.number) || 0,
      customerId: x.customerId,
      customerName: x.customerName ?? "Cliente general",
      customerPhone: x.customerPhone || undefined,
      customerDocument: x.customerDocument || undefined,
      items: Array.isArray(x.items) ? (x.items as ReceiptItem[]) : [],
      total: Number(x.total) || 0,
      method: (x.method as PaymentMethod) ?? "efectivo",
      status: x.status === "pendiente" ? "pendiente" : "pagado",
      notes: x.notes || undefined,
      docType: x.docType === "factura" ? "factura" : "recibo",
      prefix: typeof x.prefix === "string" && x.prefix ? x.prefix : undefined,
      subtotal: typeof x.subtotal === "number" ? x.subtotal : undefined,
      ivaTotal: typeof x.ivaTotal === "number" ? x.ivaTotal : undefined,
      dueDate: x.dueDate?.toDate?.() ?? undefined,
      fiscal: x.fiscal ? (x.fiscal as ReceiptFiscal) : undefined,
      transactionId: typeof x.transactionId === "string" ? x.transactionId : undefined,
      receivableId: typeof x.receivableId === "string" ? x.receivableId : undefined,
      date: x.date?.toDate?.() ?? new Date(),
      createdAt: x.createdAt?.toDate?.() ?? new Date(),
    };
  });
}

/** Elimina un recibo interno junto con el ingreso o el fiado que había registrado. Las facturas no se eliminan. */
export async function deleteReceipt(businessId: string, r: Receipt) {
  if (r.docType === "factura") throw new Error("Las facturas no se eliminan: su consecutivo es fiscal.");
  const batch = writeBatch(db);
  batch.delete(doc(db, "businesses", businessId, "receipts", r.id));
  if (r.transactionId) batch.delete(doc(db, "businesses", businessId, "transactions", r.transactionId));
  if (r.receivableId) batch.delete(doc(db, "businesses", businessId, "receivables", r.receivableId));
  await batch.commit();
}
