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
import type { Transaction } from "../types/pinak";

interface NewTransactionInput {
  type: Transaction["type"];
  amount: number;
  category: string;
  method: Transaction["method"];
  description?: string;
  date?: Date;
}

export async function addTransaction(userId: string, input: NewTransactionInput) {
  const ref = collection(db, "users", userId, "transactions");
  await addDoc(ref, {
    type: input.type,
    amount: input.amount,
    category: input.category,
    method: input.method,
    description: input.description ?? "",
    date: input.date ? Timestamp.fromDate(input.date) : serverTimestamp(),
    source: "manual",
    createdAt: serverTimestamp(),
  });
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: NewTransactionInput
) {
  const ref = doc(db, "users", userId, "transactions", transactionId);
  await updateDoc(ref, {
    type: input.type,
    amount: input.amount,
    category: input.category,
    method: input.method,
    description: input.description ?? "",
    ...(input.date ? { date: Timestamp.fromDate(input.date) } : {}),
  });
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const ref = doc(db, "users", userId, "transactions", transactionId);
  await deleteDoc(ref);
}

export function useTransactions(userId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", userId, "transactions"),
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
  }, [userId]);

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
