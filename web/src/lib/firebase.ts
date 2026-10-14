// Configuración central de Firebase para PINAK (web)
// Las variables reales se leen desde .env.local (ver .env.local.example)

import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Evita reinicializar la app en hot-reload de Next.js
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check: demuestra al servidor que las llamadas vienen de la web real. Solo se activa si
// NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY está definida (ver README → App Check).
const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
if (typeof window !== "undefined" && recaptchaKey) {
  try {
    const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
    if (debugToken) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    /* ya estaba inicializado (hot-reload) */
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export default app;
