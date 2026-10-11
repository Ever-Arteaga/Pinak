import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { loginUser, registerUser, sendPasswordReset } from "../lib/auth";
import { PlanIntro, readIntroPlan } from "../components/PlanIntro";
import { useTheme } from "../theme";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { colors, themedStyles } from "../theme";

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [info, setInfo] = useState<string | null>(null);
  const [chosenPlan, setChosenPlan] = useState<string | null>(null);
  const { mode: themeMode, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    readIntroPlan().then(setChosenPlan);
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    if (mode === "register" && businessName.trim().length < 2) {
      setError("Escribe el nombre de tu negocio.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Escribe un correo válido.");
      return;
    }
    if (mode !== "reset" && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "reset") {
        await sendPasswordReset(email);
        setInfo(
          "Si ese correo está registrado, te enviamos un enlace para crear una nueva contraseña. Revisa tu bandeja de entrada y también spam."
        );
        return;
      }
      if (mode === "login") {
        await loginUser(email, password);
      } else {
        await registerUser(email, password, businessName);
      }
    } catch (err) {
      if (mode === "reset" && err instanceof Error && err.message.includes("auth/user-not-found")) {
        setInfo(
          "Si ese correo está registrado, te enviamos un enlace para crear una nueva contraseña. Revisa tu bandeja de entrada y también spam."
        );
      } else {
        setError(err instanceof Error ? traducirError(err.message) : "Error inesperado.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <PlanIntro
          onChoose={(plan) => {
            setChosenPlan(plan);
            setMode("register");
          }}
        />
        <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn} hitSlop={8}>
          <Text style={{ fontSize: 18 }}>{themeMode === "dark" ? "☀️" : "🌙"}</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>PINAK</Text>

        <View style={styles.card}>
          <Text style={styles.title}>
            {mode === "login" ? "Bienvenido de nuevo" : mode === "reset" ? "Recupera tu contraseña" : "Crea tu cuenta"}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "login"
              ? "Ingresa a tu negocio en piloto automático."
              : mode === "reset"
              ? "Te enviaremos un enlace a tu correo para crear una nueva."
              : chosenPlan === "pro" || chosenPlan === "premium"
              ? `Elegiste el plan ${chosenPlan === "pro" ? "Pro" : "Premium"}: crea tu cuenta y actívalo desde Planes.`
              : "Empieza gratis, sin tarjeta de crédito."}
          </Text>

          {mode !== "reset" && (
            <>
              <GoogleSignInButton onError={setError} disabled={loading} />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o con tu correo</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          {mode === "register" && (
            <View style={styles.field}>
              <Text style={styles.label}>Nombre del negocio</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Ej. Tienda Doña Rosa"
                placeholderTextColor={colors.inkSoft}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="tucorreo@ejemplo.com"
              placeholderTextColor={colors.inkSoft}
            />
          </View>

          {mode !== "reset" && (
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.inkSoft}
            />
          </View>
          )}
          {mode === "login" && (
            <TouchableOpacity
              onPress={() => {
                setMode("reset");
                setError(null);
                setInfo(null);
              }}
              style={{ marginBottom: 10 }}
            >
              <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          )}

          {info && <Text style={styles.info}>{info}</Text>}
          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Un momento..." : mode === "reset" ? "Enviar enlace" : mode === "login" ? "Ingresar" : "Crear cuenta gratis"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setInfo(null);
            }}
          >
            <Text style={styles.switchText}>
              {mode === "login"
                ? "¿No tienes cuenta? Regístrate gratis"
                : mode === "reset"
                ? "Volver a iniciar sesión"
                : "¿Ya tienes cuenta? Inicia sesión"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function traducirError(message: string): string {
  if (message.includes("auth/email-already-in-use")) return "Ese correo ya está registrado.";
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password"))
    return "Correo o contraseña incorrectos.";
  if (message.includes("auth/user-not-found")) return "No encontramos una cuenta con ese correo.";
  if (message.includes("auth/invalid-email")) return "El correo no es válido.";
  if (message.includes("auth/too-many-requests")) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (message.includes("auth/weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
  return "Ocurrió un error. Intenta de nuevo.";
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: colors.title,
    marginBottom: 32,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.title },
  subtitle: { fontSize: 13, color: colors.inkSoft, marginTop: 4, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  themeBtn: { position: "absolute", right: 0, top: 0, padding: 8 },
  forgot: { color: colors.green600, fontSize: 12.5, fontWeight: "600" },
  info: { color: colors.green600, backgroundColor: colors.green100, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.navy900,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: { color: colors.onNavy, fontWeight: "700", fontSize: 14 },
  switchText: {
    textAlign: "center",
    color: colors.inkSoft,
    fontSize: 13,
    marginTop: 16,
  },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12, color: colors.inkSoft, marginHorizontal: 10 },
}));
