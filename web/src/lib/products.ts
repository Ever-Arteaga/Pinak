"use client";

import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useBusinessCollection } from "./collections";
import type { Product, ProductKind } from "@/types/pinak";

export interface ProductInput {
  name: string;
  price: number;
  kind: ProductKind;
}

export async function addProduct(businessId: string, input: ProductInput) {
  await addDoc(collection(db, "businesses", businessId, "products"), {
    name: input.name.trim(),
    price: input.price,
    kind: input.kind,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? "",
  });
}

export async function updateProduct(businessId: string, productId: string, input: ProductInput) {
  await updateDoc(doc(db, "businesses", businessId, "products", productId), {
    name: input.name.trim(),
    price: input.price,
    kind: input.kind,
  });
}

export async function deleteProduct(businessId: string, productId: string) {
  await deleteDoc(doc(db, "businesses", businessId, "products", productId));
}

export function useProducts(businessId: string | undefined) {
  return useBusinessCollection<Product>(businessId, "products", "name", "asc", (d) => {
    const x = d.data();
    return {
      id: d.id,
      name: x.name ?? "",
      price: Number(x.price) || 0,
      kind: x.kind === "servicio" ? "servicio" : "producto",
      createdAt: x.createdAt?.toDate?.() ?? new Date(),
    };
  });
}
