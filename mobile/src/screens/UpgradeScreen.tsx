import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthUser } from "../lib/auth";
import { useUserProfile } from "../lib/userProfile";
import { createBoldCheckout, type BoldCheckoutData } from "../lib/payments";
import { startTrial } from "../lib/businessApi";
import { BoldCheckoutModal } from "../components/BoldCheckoutModal";
import { AppHeader } from "../components/AppHeader";
import { colors, themedStyles } from "../theme";
import { PLAN_LIMITS, type Plan } from "../types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const PLAN_FEATURES: Record<"pro" | "premium", string[]> = {
  pro: [
    "Registro por voz y texto con IA, sin límite",
    "2 usuarios en tu negocio (tú y una persona más)",
    "Fiados y cobro por WhatsApp",
    "Reportes exportables a PDF y Excel",
  ],
  premium: [
    "Todo lo de Pro",
    "Usuarios ilimitados en cada negocio",
    "Varios negocios en una sola cuenta",
    "Diagnóstico financiero mensual con IA",
    "Modo privacidad en pantalla",
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
  const [trialMsg, setTrialMsg] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<BoldCheckoutData | null>(null);

  if (!user) return null;

  function canTrial(plan: "pro" | "premium") {
    if (!profile || profile.trialsUsed[plan] || profile.plan === plan) return false;
    if (profile.plan === "emprendedor") return true;
    return profile.planTrial && profile.plan === "pro" && plan === "premium";
  }

  async function handleTrial(plan: "pro" | "premium") {
    setError(null);
    setLoadingPlan(plan);
    try {
      await startTrial({ plan });
      setTrialMsg(`¡Listo! Tienes 15 días de ${plan === "pro" ? "Pro" : "Premium"} gratis.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la prueba.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleUpgrade(plan: "pro" | "premium") {
    setError(null);
    setLoadingPlan(plan);
    try {
      const data = await createBoldCheckout(plan);
      setCheckoutData(data);
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

        {profile?.planTrial && profile.planExpiresAt && (
          <Text style={styles.trialInfo}>
            Prueba gratuita activa hasta el{" "}
            {profile.planExpiresAt.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.
          </Text>
        )}
        {trialMsg && <Text style={styles.trialInfo}>{trialMsg}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        {(["pro", "premium"] as const).map((plan) => {
          const isCurrent = profile?.plan === plan && !profile?.planTrial;
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
              {canTrial(plan) && (
                <TouchableOpacity
                  style={[styles.trialButton, isPremium && styles.trialButtonDark]}
                  onPress={() => handleTrial(plan)}
                  disabled={loadingPlan !== null}
                >
                  <Text style={[styles.trialButtonText, isPremium && styles.textWhite]}>
                    Probar 15 días gratis
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <Text style={styles.footnote}>
          La prueba gratuita no pide tarjeta y se activa una sola vez por plan. Pagas de forma segura con Bold (Nequi, tarjeta, PSE). Tu plan se
          renueva mes a mes — te avisaremos antes de que venza.
        </Text>
      </ScrollView>

      <BoldCheckoutModal
        visible={checkoutData !== null}
        checkoutData={checkoutData}
        onClose={() => setCheckoutData(null)}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 60 },
  trialInfo: {
    backgroundColor: colors.green100,
    color: colors.green600,
    fontSize: 12.5,
    textAlign: "center",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  trialButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  trialButtonDark: { borderColor: "rgba(255,255,255,0.4)" },
  trialButtonText: { color: colors.title, fontWeight: "700", fontSize: 14 },
  currentPlan: { textAlign: "center", fontSize: 13, color: colors.inkSoft },
  currentPlanValue: { fontWeight: "700", color: colors.title },
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
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.title },
  cardPrice: { fontSize: 14, fontWeight: "700", color: colors.title },
  cardPriceUnit: { fontSize: 11, fontWeight: "400", opacity: 0.7 },
  textWhite: { color: colors.onNavy },
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
  buttonText: { color: colors.onNavy, fontWeight: "700", fontSize: 14 },
  buttonTextDark: { color: colors.title },
  footnote: { marginTop: 24, textAlign: "center", fontSize: 11, color: colors.inkSoft },
}));
