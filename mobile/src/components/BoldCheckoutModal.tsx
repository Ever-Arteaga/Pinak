import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import {
  BOLD_REDIRECT_URL,
  buildBoldCheckoutHtml,
  type BoldCheckoutData,
} from "../lib/payments";
import { colors } from "../theme";

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

  function handleNavigationChange(navState: WebViewNavigation) {
    if (navState.url.startsWith(BOLD_REDIRECT_URL)) {
      onClose();
    }
  }

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

        <WebView
          source={{ html: buildBoldCheckoutHtml(checkoutData) }}
          onNavigationStateChange={handleNavigationChange}
          onLoadEnd={() => setLoading(false)}
          style={styles.webview}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.navy900} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: 16, fontWeight: "700", color: colors.navy900 },
  close: { fontSize: 16, color: colors.inkSoft },
  webview: { flex: 1 },
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
});
