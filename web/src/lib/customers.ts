"use client";

import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useBusinessCollection } from "./collections";
import type { Customer } from "@/types/pinak";

export interface CustomerInput {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  address?: string;
  notes?: string;
}

function clean(input: CustomerInput) {
  return {
    name: input.name.trim(),
    phone: (input.phone ?? "").trim(),
    email: (input.email ?? "").trim(),
    document: (input.document ?? "").trim(),
    address: (input.address ?? "").trim(),
    notes: (input.notes ?? "").trim(),
  };
}

export async function addCustomer(businessId: string, input: CustomerInput): Promise<string> {
  const ref = await addDoc(collection(db, "businesses", businessId, "customers"), {
    ...clean(input),
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? "",
  });
  return ref.id;
}

export async function updateCustomer(businessId: string, customerId: string, input: CustomerInput) {
  await updateDoc(doc(db, "businesses", businessId, "customers", customerId), clean(input));
}

export async function deleteCustomer(businessId: string, customerId: string) {
  await deleteDoc(doc(db, "businesses", businessId, "customers", customerId));
}

export function useCustomers(businessId: string | undefined) {
  return useBusinessCollection<Customer>(businessId, "customers", "name", "asc", (d) => {
    const x = d.data();
    return {
      id: d.id,
      name: x.name ?? "",
      phone: x.phone ?? "",
      email: x.email ?? "",
      document: x.document ?? "",
      address: x.address ?? "",
      notes: x.notes ?? "",
      createdAt: x.createdAt?.toDate?.() ?? new Date(),
    };
  });
}
