import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthUser } from "../lib/auth";
import { useUserProfile } from "../lib/userProfile";
import { startPlanUpgrade } from "../lib/payments";
import { AppHeader } from "../components/AppHeader";
import { colors } from "../theme";
import { PLAN_LIMITS, type Plan } from "../types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const PLAN_FEATURES: Record<"pro" | "premium", string[]> = {
  pro: [
    "Registro por voz/texto con IA — ilimitado",
    "Hasta 2 usuarios",
    "Fiados y cobro por WhatsApp",
    "Reportes en PDF y Excel",
  ],
  premium: [
    "Todo lo de Pro",
    "Usuarios y negocios ilimitados",
    "Modo privacidad en pantalla",
    "Diagnóstico financiero mensual con IA",
    "Soporte prioritario",
  ],
};

const PLAN_LABEL: Record<Plan, string> = {
  emprendedor: "Emprendedor (gratis)",
  pro: "Pro",
  premium: "Premium",
};

export default function UpgradeScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const [loadingPlan, setLoadingPlan] = useState<"pro" | "premium" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleUpgrade(plan: "pro" | "premium") {
    setError(null);
    setLoadingPlan(plan);
    try {
      await startPlanUpgrade(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <View style={styles.container}>
      <AppHeader onBack={onBack} backLabel="Dashboard" title="Planes" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.currentPlan}>
          Tu plan actual:{" "}
          <Text style={styles.currentPlanValue}>
            {profile ? PLAN_LABEL[profile.plan] : "..."}
          </Text>
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {(["pro", "premium"] as const).map((plan) => {
          const isCurrent = profile?.plan === plan;
          const isPremium = plan === "premium";
          return (
            <View
              key={plan}
              style={[styles.card, isPremium && styles.cardPremium]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, isPremium && styles.textWhite]}>
                  {plan === "pro" ? "Pro" : "Premium"}
                </Text>
                <Text style={[styles.cardPrice, isPremium && styles.textWhite]}>
                  {currency.format(PLAN_LIMITS[plan].priceCOP)}
                  <Text style={styles.cardPriceUnit}>/mes</Text>
                </Text>
              </View>

              {PLAN_FEATURES[plan].map((f) => (
                <Text
                  key={f}
                  style={[styles.feature, isPremium && styles.featureWhite]}
                >
                  ✓ {f}
                </Text>
              ))}

              <TouchableOpacity
                style={[
                  styles.button,
                  isPremium && styles.buttonWhite,
                  (isCurrent || loadingPlan !== null) && styles.buttonDisabled,
                ]}
                onPress={() => handleUpgrade(plan)}
                disabled={isCurrent || loadingPlan !== null}
              >
                <Text style={[styles.buttonText, isPremium && styles.buttonTextDark]}>
                  {isCurrent
                    ? "Tu plan actual"
                    : loadingPlan === plan
                    ? "Abriendo pago..."
                    : `Actualizar a ${plan === "pro" ? "Pro" : "Premium"}`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={styles.footnote}>
          Pagas de forma segura con Wompi (Nequi, PSE, tarjeta). Tu plan se
          renueva mes a mes — te avisaremos antes de que venza.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 60 },
  currentPlan: { textAlign: "center", fontSize: 13, color: colors.inkSoft },
  currentPlanValue: { fontWeight: "700", color: colors.navy900 },
  error: {
    marginTop: 14,
    color: colors.danger,
    backgroundColor: "#fdf0ee",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlign: "center",
  },
  card: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 18,
  },
  cardPremium: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.navy900 },
  cardPrice: { fontSize: 14, fontWeight: "700", color: colors.navy900 },
  cardPriceUnit: { fontSize: 11, fontWeight: "400", opacity: 0.7 },
  textWhite: { color: colors.white },
  feature: { fontSize: 13, color: colors.inkSoft, marginTop: 6 },
  featureWhite: { color: "rgba(255,255,255,0.9)" },
  button: {
    marginTop: 16,
    backgroundColor: colors.navy900,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonWhite: { backgroundColor: colors.white },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  buttonTextDark: { color: colors.navy900 },
  footnote: { marginTop: 24, textAlign: "center", fontSize: 11, color: colors.inkSoft },
});
