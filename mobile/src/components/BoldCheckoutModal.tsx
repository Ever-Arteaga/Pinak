import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import {
  BOLD_REDIRECT_URL,
  getCheckoutStatus,
  buildBoldCheckoutHtml,
  type BoldCheckoutData,
} from "../lib/payments";
import { colors, themedStyles } from "../theme";

/**
 * Modal de pantalla completa que carga el checkout de Bold dentro de un
 * WebView (Bold funciona con un script/constructor JS, no con una URL
 * directa que se pueda abrir en el navegador del sistema). Cuando el
 * WebView navega a la URL de redirección, se cierra solo — el plan se
 * confirma por separado vía el webhook + el listener en tiempo real de
 * useUserProfile, no por esta pantalla.
 */
export function BoldCheckoutModal({
  visible,
  checkoutData,
  onClose,
}: {
  visible: boolean;
  checkoutData: BoldCheckoutData | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<"paying" | "checking" | "success" | "failed">("paying");

  useEffect(() => {
    if (visible) {
      setPhase("paying");
      setLoading(true);
    }
  }, [visible, checkoutData?.orderId]);

  function handleNavigationChange(navState: WebViewNavigation) {
    if (phase !== "paying" || !navState.url.startsWith(BOLD_REDIRECT_URL)) return;
    // Bold agrega el estado del pago a la URL de redirección.
    const m = navState.url.match(/[?&]bold-tx-status=([^&#]+)/);
    setPhase(m && (m[1] === "rejected" || m[1] === "failed") ? "failed" : "checking");
  }

  // Tras volver de Bold, se pregunta al servidor hasta que el pago quede confirmado.
  useEffect(() => {
    if (phase !== "checking" || !checkoutData) return;
    let stop = false;
    const check = async () => {
      try {
        const status = await getCheckoutStatus(checkoutData.orderId);
        if (!stop && status === "completed") setPhase("success");
      } catch {
        /* se reintenta */
      }
    };
    check();
    const timer = setInterval(check, 2500);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [phase, checkoutData]);

  if (!checkoutData) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pago seguro</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {phase === "paying" ? (
          <WebView
            source={{ html: buildBoldCheckoutHtml(checkoutData) }}
            onNavigationStateChange={handleNavigationChange}
            onLoadEnd={() => setLoading(false)}
            style={styles.webview}
          />
        ) : (
          <View style={styles.result}>
            {phase === "checking" && <ActivityIndicator size="large" color={colors.navy900} />}
            <Text style={styles.resultTitle}>
              {phase === "checking" && "Confirmando tu pago..."}
              {phase === "success" && "¡Pago confirmado!"}
              {phase === "failed" && "No se pudo completar el pago"}
            </Text>
            <Text style={styles.resultText}>
              {phase === "checking" && "Esto suele tardar unos segundos. No cierres esta pantalla."}
              {phase === "success" && "Tu plan ya está activo."}
              {phase === "failed" && "Tu plan no cambió y no se te cobró. Puedes intentarlo de nuevo."}
            </Text>
            {phase !== "checking" && (
              <TouchableOpacity style={styles.resultBtn} onPress={onClose}>
                <Text style={styles.resultBtnText}>{phase === "success" ? "Listo" : "Volver a planes"}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading && phase === "paying" && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.navy900} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.title },
  close: { fontSize: 16, color: colors.inkSoft },
  webview: { flex: 1 },
  result: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  resultTitle: { fontSize: 18, fontWeight: "700", color: colors.title, textAlign: "center" },
  resultText: { fontSize: 13.5, color: colors.inkSoft, textAlign: "center" },
  resultBtn: { marginTop: 12, backgroundColor: colors.navy900, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  resultBtnText: { color: colors.onNavy, fontWeight: "700", fontSize: 14 },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
}));
