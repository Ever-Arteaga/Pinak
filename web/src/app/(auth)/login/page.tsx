"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser, loginWithGoogle, registerUser } from "@/lib/auth";
import { PinakLogoFull } from "@/components/PinakLogo";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await loginUser(email, password);
      } else {
        await registerUser(email, password, businessName);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? traducirErrorFirebase(err.message)
          : "Ocurrió un error inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? traducirErrorFirebase(err.message)
          : "Ocurrió un error inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <PinakLogoFull width={190} />
        </div>

        <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
          <h1 className="font-display text-xl font-semibold text-navy-900">
            {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {mode === "login"
              ? "Ingresa a tu negocio en piloto automático."
              : "Empieza gratis, sin tarjeta de crédito."}
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream disabled:opacity-60"
          >
            <GoogleIcon />
            Continuar con Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-soft">o con tu correo</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">
                  Nombre del negocio
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  placeholder="Ej. Tienda Doña Rosa"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60"
            >
              {loading
                ? "Un momento..."
                : mode === "login"
                ? "Ingresar"
                : "Crear cuenta gratis"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="mt-5 w-full text-center text-sm text-ink-soft hover:text-navy-900"
          >
            {mode === "login"
              ? "¿No tienes cuenta? Regístrate gratis"
              : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.1 27 36 24 36c-5.2 0-9.6-3.4-11.2-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.2 5.7l6.6 5.6C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

function traducirErrorFirebase(message: string): string {
  if (message.includes("auth/email-already-in-use"))
    return "Ese correo ya está registrado.";
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password"))
    return "Correo o contraseña incorrectos.";
  if (message.includes("auth/user-not-found"))
    return "No encontramos una cuenta con ese correo.";
  if (message.includes("auth/weak-password"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (message.includes("auth/popup-closed-by-user"))
    return "Cerraste la ventana de Google antes de terminar.";
  if (message.includes("auth/unauthorized-domain"))
    return "Este dominio no está autorizado en Firebase Authentication.";
  return "Ocurrió un error. Intenta de nuevo.";
}
