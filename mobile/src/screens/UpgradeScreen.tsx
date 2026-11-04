import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuthUser } from "../lib/auth";
import { useUserProfile } from "../lib/userProfile";
import { createBoldCheckout, type BoldCheckoutData } from "../lib/payments";
import { freePlanAccess, startTrial } from "../lib/businessApi";
import { BoldCheckoutModal } from "../components/BoldCheckoutModal";
import { AppHeader } from "../components/AppHeader";
import { colors, themedStyles } from "../theme";
import { PLAN_LIMITS, type Plan } from "../types/pinak";

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type PayPlan = "essential" | "pro" | "premium";
const ORDER = { emprendedor: 0, essential: 1, pro: 2, premium: 3 } as const;

const PLAN_FEATURES: Record<PayPlan, string[]> = {
  essential: [
    "Pensado para tu cuenta personal",
    "Registra tus ingresos y gastos por voz y texto con IA",
    "Cobra lo que te deben por WhatsApp",
    "Reportes exportables a PDF y Excel",
  ],
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
    "Recibos de venta en PDF, clientes y catálogo",
    "Agenda de citas con cobro",
    "Modo privacidad en pantalla",
    "Soporte prioritario",
  ],
};

const PLAN_LABEL: Record<Plan, string> = {
  emprendedor: "Emprendedor (gratis)",
  essential: "Essential",
  pro: "Pro",
  premium: "Premium",
};

export default function UpgradeScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const [loadingPlan, setLoadingPlan] = useState<PayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trialMsg, setTrialMsg] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<BoldCheckoutData | null>(null);

  const [testAccess, setTestAccess] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  // Cuentas de pruebas (correos autorizados en el servidor): cambian de plan sin pagar.
  useEffect(() => {
    if (!user) return;
    freePlanAccess({}).then((r) => setTestAccess(r.enabled === true)).catch(() => setTestAccess(false));
  }, [user]);

  async function switchPlan(plan: Plan) {
    setError(null);
    setSwitching(plan);
    try {
      await freePlanAccess({ plan });
      setTrialMsg(`Listo, ahora estás en ${PLAN_LABEL[plan]}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el plan.");
    } finally {
      setSwitching(null);
    }
  }

  if (!user) return null;

  function canTrial(plan: PayPlan) {
    if (!profile || profile.trialsUsed[plan] || profile.plan === plan) return false;
    if (profile.plan === "emprendedor") return true;
    return profile.planTrial && ORDER[profile.plan] < ORDER[plan];
  }

  async function handleTrial(plan: PayPlan) {
    setError(null);
    setLoadingPlan(plan);
    try {
      await startTrial({ plan });
      setTrialMsg(`¡Listo! Tienes 10 días de ${PLAN_LABEL[plan]} gratis.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la prueba.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleUpgrade(plan: PayPlan) {
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

        {testAccess && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cuenta de pruebas</Text>
            <Text style={styles.feature}>Cambia de plan sin pagar para probar cada uno.</Text>
            {(["emprendedor", "essential", "pro", "premium"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.button, (switching !== null || profile?.plan === p) && styles.buttonDisabled]}
                onPress={() => switchPlan(p)}
                disabled={switching !== null || profile?.plan === p}
              >
                <Text style={styles.buttonText}>{profile?.plan === p ? "✓ " : ""}{PLAN_LABEL[p]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(["essential", "pro", "premium"] as const).map((plan) => {
          const isCurrent = profile?.plan === plan && !profile?.planTrial;
          const isPremium = plan === "premium";
          return (
            <View
              key={plan}
              style={[styles.card, isPremium && styles.cardPremium]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, isPremium && styles.textWhite]}>
                  {PLAN_LABEL[plan].replace(" (gratis)", "")}
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
                    : `Actualizar a ${PLAN_LABEL[plan]}`}
                </Text>
              </TouchableOpacity>
              {canTrial(plan) && (
                <TouchableOpacity
                  style={[styles.trialButton, isPremium && styles.trialButtonDark]}
                  onPress={() => handleTrial(plan)}
                  disabled={loadingPlan !== null}
                >
                  <Text style={[styles.trialButtonText, isPremium && styles.textWhite]}>
                    Probar 10 días gratis
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
