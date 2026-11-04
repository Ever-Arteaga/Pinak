"use client";

import { addDoc, collection, deleteDoc, doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useBusinessCollection } from "./collections";
import type { Appointment } from "@/types/pinak";

export interface AppointmentInput {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  serviceName: string;
  price: number;
  start: Date;
  durationMin: number;
  notes?: string;
}

export async function addAppointment(businessId: string, input: AppointmentInput) {
  await addDoc(collection(db, "businesses", businessId, "appointments"), {
    ...(input.customerId ? { customerId: input.customerId } : {}),
    customerName: input.customerName.trim(),
    customerPhone: (input.customerPhone ?? "").trim(),
    serviceName: input.serviceName.trim(),
    price: input.price,
    start: Timestamp.fromDate(input.start),
    durationMin: input.durationMin,
    status: "agendada",
    paid: false,
    notes: (input.notes ?? "").trim(),
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? "",
  });
}

export async function updateAppointment(businessId: string, id: string, input: AppointmentInput) {
  await updateDoc(doc(db, "businesses", businessId, "appointments", id), {
    customerName: input.customerName.trim(),
    customerPhone: (input.customerPhone ?? "").trim(),
    serviceName: input.serviceName.trim(),
    price: input.price,
    start: Timestamp.fromDate(input.start),
    durationMin: input.durationMin,
    notes: (input.notes ?? "").trim(),
  });
}

export async function cancelAppointment(businessId: string, id: string) {
  await updateDoc(doc(db, "businesses", businessId, "appointments", id), { status: "cancelada" });
}

export async function deleteAppointment(businessId: string, id: string) {
  await deleteDoc(doc(db, "businesses", businessId, "appointments", id));
}

export function useAppointments(businessId: string | undefined) {
  return useBusinessCollection<Appointment>(businessId, "appointments", "start", "asc", (d) => {
    const x = d.data();
    return {
      id: d.id,
      customerId: x.customerId,
      customerName: x.customerName ?? "",
      customerPhone: x.customerPhone || undefined,
      serviceName: x.serviceName ?? "",
      price: Number(x.price) || 0,
      start: x.start?.toDate?.() ?? new Date(),
      durationMin: Number(x.durationMin) || 30,
      status: x.status === "atendida" || x.status === "cancelada" ? x.status : "agendada",
      paid: x.paid === true,
      receiptId: x.receiptId,
      notes: x.notes || undefined,
      createdAt: x.createdAt?.toDate?.() ?? new Date(),
    };
  });
}

function normalizePhone(raw?: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

/** Enlace de WhatsApp con el recordatorio de la cita. */
export function appointmentReminderLink(businessName: string, a: Appointment): string {
  const fecha = a.start.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const hora = a.start.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const negocio = businessName.trim() || "nuestro negocio";
  const msg =
    `¡Hola ${a.customerName}! 👋 Te recordamos tu cita de ${a.serviceName} en ${negocio}: ` +
    `${fecha} a las ${hora}. Si necesitas cambiarla, escríbenos. ¡Te esperamos! 🙌`;
  const phone = normalizePhone(a.customerPhone);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
