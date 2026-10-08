"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { ensureBusiness } from "./businessApi";

// Mientras se registra una cuenta nueva, el proveedor de negocios espera: así el
// primer negocio se crea con el nombre que la persona escribió.
let bootstrapping = false;
export function isAuthBootstrapping() {
  return bootstrapping;
}

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
}

export async function registerUser(
  email: string,
  password: string,
  businessName: string
) {
  bootstrapping = true;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: businessName });
    await ensureUserDocument(credential.user.uid, email, businessName);
    // Necesario para poder aceptar invitaciones a otros negocios. Si falla, no es grave.
    sendEmailVerification(credential.user).catch(() => {});
    // Si crear el primer negocio falla (red, funciones sin desplegar), la cuenta ya existe:
    // el proveedor de negocios lo reintenta y ofrece un botón "Reintentar".
    await ensureBusiness({ businessName }).catch(() => {});
    return credential.user;
  } finally {
    bootstrapping = false;
  }
}

export async function loginUser(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function loginWithGoogle() {
  bootstrapping = true;
  try {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    const businessName = credential.user.displayName || "Mi negocio";
    await ensureUserDocument(credential.user.uid, credential.user.email ?? "", businessName);
    // Si crear el primer negocio falla (red, funciones sin desplegar), la cuenta ya existe:
    // el proveedor de negocios lo reintenta y ofrece un botón "Reintentar".
    await ensureBusiness({ businessName }).catch(() => {});
    return credential.user;
  } finally {
    bootstrapping = false;
  }
}

export async function logoutUser() {
  await signOut(auth);
}
