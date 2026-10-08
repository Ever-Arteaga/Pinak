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
import type { Transaction } from "@/types/pinak";

interface NewTransactionInput {
  type: Transaction["type"];
  amount: number;
  category: string;
  method: Transaction["method"];
  description?: string;
  date?: Date;
  /** Origen del registro. Por defecto "manual". */
  source?: Transaction["source"];
}

export async function addTransaction(businessId: string, input: NewTransactionInput) {
  const ref = collection(db, "businesses", businessId, "transactions");
  await addDoc(ref, {
    type: input.type,
    amount: input.amount,
    category: input.category,
    method: input.method,
    description: input.description ?? "",
    date: input.date ? Timestamp.fromDate(input.date) : serverTimestamp(),
    source: input.source ?? "manual",
    createdAt: serverTimestamp(),
  });
}

export async function updateTransaction(
  businessId: string,
  transactionId: string,
  input: NewTransactionInput
) {
  const ref = doc(db, "businesses", businessId, "transactions", transactionId);
  await updateDoc(ref, {
    type: input.type,
    amount: input.amount,
    category: input.category,
    method: input.method,
    description: input.description ?? "",
    ...(input.date ? { date: Timestamp.fromDate(input.date) } : {}),
  });
}

export async function deleteTransaction(businessId: string, transactionId: string) {
  const ref = doc(db, "businesses", businessId, "transactions", transactionId);
  await deleteDoc(ref);
}

export function useTransactions(businessId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "businesses", businessId, "transactions"),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          type: data.type,
          amount: data.amount,
          category: data.category,
          method: data.method,
          description: data.description,
          date: data.date?.toDate?.() ?? new Date(),
          source: data.source ?? "manual",
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        } as Transaction;
      });
      setTransactions(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [businessId]);

  return { transactions, loading };
}

export function computeBalance(transactions: Transaction[]) {
  return transactions.reduce(
    (acc, t) => {
      if (t.type === "ingreso") {
        acc.totalIngresos += t.amount;
        acc.balance += t.amount;
      } else {
        acc.totalEgresos += t.amount;
        acc.balance -= t.amount;
      }
      return acc;
    },
    { balance: 0, totalIngresos: 0, totalEgresos: 0 }
  );
}
