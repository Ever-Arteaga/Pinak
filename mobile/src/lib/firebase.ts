import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import { initializeAuth, getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

const firebaseConfig: FirebaseOptions = {
  apiKey: extra.firebaseApiKey,
  authDomain: extra.firebaseAuthDomain,
  projectId: extra.firebaseProjectId,
  storageBucket: extra.firebaseStorageBucket,
  messagingSenderId: extra.firebaseMessagingSenderId,
  appId: extra.firebaseAppId,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// La sesión se guarda en el teléfono para no pedir el inicio de sesión cada vez.
function createAuth() {
  try {
    return initializeAuth(app, { persistence: (FirebaseAuth as unknown as { getReactNativePersistence: (s: typeof AsyncStorage) => FirebaseAuth.Persistence }).getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}
export const auth = createAuth();
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export default app;
