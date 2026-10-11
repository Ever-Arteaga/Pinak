import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { ensureBusiness } from "./businessApi";

// Mientras se registra una cuenta nueva, el proveedor de negocios espera para crear
// el primer negocio con el nombre que la persona escribió.
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

export async function registerUser(email: string, password: string, businessName: string) {
  bootstrapping = true;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: businessName });
    await ensureUserDocument(credential.user.uid, email, businessName);
    sendEmailVerification(credential.user).catch(() => {});
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

export async function signInWithGoogleIdToken(idToken: string) {
  bootstrapping = true;
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    const businessName = result.user.displayName || "Mi negocio";
    await ensureUserDocument(result.user.uid, result.user.email ?? "", businessName);
    await ensureBusiness({ businessName }).catch(() => {});
    return result.user;
  } finally {
    bootstrapping = false;
  }
}

/** Envía el correo para restablecer la contraseña (en español). */
export async function sendPasswordReset(email: string) {
  auth.languageCode = "es";
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser() {
  await signOut(auth);
}
