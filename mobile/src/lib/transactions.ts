
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  limit,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import type { Transaction } from "../types/pinak";

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
    createdBy: auth.currentUser?.uid ?? "",
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

export interface TransactionsOptions {
  /** Máximo de movimientos a escuchar (los más recientes). */
  limit?: number;
  /** Solo movimientos desde esta fecha. */
  since?: Date;
}

export function useTransactions(businessId: string | undefined, opts: TransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const limitN = opts.limit ?? 0;
  const sinceMs = opts.since ? opts.since.getTime() : 0;

  useEffect(() => {
    if (!businessId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setError(null);
    const q = query(
      collection(db, "businesses", businessId, "transactions"),
      ...(sinceMs ? [where("date", ">=", Timestamp.fromMillis(sinceMs))] : []),
      orderBy("date", "desc"),
      ...(limitN ? [limit(limitN)] : [])
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
    }, (err) => {
      console.error("No se pudieron cargar los datos:", err);
      setError("No pudimos cargar tus datos. Revisa tu conexión e intenta de nuevo.");
      setLoading(false);
    });

    return unsubscribe;
  }, [businessId, attempt, limitN, sinceMs]);

  const retry = () => {
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  return { transactions, loading, error, retry };
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
