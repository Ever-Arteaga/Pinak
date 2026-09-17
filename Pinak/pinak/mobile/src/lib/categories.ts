import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Category, TransactionType } from "../types/pinak";

export function useCategories(userId: string | undefined) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "users", userId, "categories"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          type: data.type,
          icon: data.icon,
          isDefault: data.isDefault ?? false,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        } as Category;
      });
      setCategories(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  return { categories, loading };
}

export async function addCategory(userId: string, name: string, type: TransactionType) {
  const ref = collection(db, "users", userId, "categories");
  await addDoc(ref, {
    name,
    type,
    icon: "🏷️",
    isDefault: false,
    createdAt: serverTimestamp(),
  });
}

export function filterCategoriesByType(categories: Category[], type: TransactionType) {
  return categories.filter((c) => c.type === type);
}
