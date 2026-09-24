import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { DEFAULT_CATEGORIES } from "../types/pinak";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}

async function ensureUserDocument(uid: string, email: string, businessName: string) {
  const userRef = doc(db, "users", uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) return;

  await setDoc(userRef, {
    email,
    businessName,
    plan: "emprendedor",
    planStartedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    privacyModeEnabled: false,
  });

  await Promise.all(
    DEFAULT_CATEGORIES.map((cat, index) =>
      setDoc(doc(db, "users", uid, "categories", `default-${index}`), {
        ...cat,
        isDefault: true,
        createdAt: serverTimestamp(),
      })
    )
  );
}

export async function registerUser(
  email: string,
  password: string,
  businessName: string
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: businessName });
  await ensureUserDocument(credential.user.uid, email, businessName);
  return credential.user;
}

export async function loginUser(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  const businessName = result.user.displayName || "Mi negocio";
  await ensureUserDocument(result.user.uid, result.user.email ?? "", businessName);
  return result.user;
}

export async function logoutUser() {
  await signOut(auth);
}
