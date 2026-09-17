import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { signInWithGoogleIdToken } from "../lib/auth";
import { colors } from "../theme";

WebBrowser.maybeCompleteAuthSession();

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export function GoogleSignInButton({
  onError,
  disabled,
}: {
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: extra.googleIosClientId,
    androidClientId: extra.googleAndroidClientId,
    webClientId: extra.googleWebClientId,
  });

  useEffect(() => {
    if (response?.type === "success" && response.authentication?.idToken) {
      signInWithGoogleIdToken(response.authentication.idToken).catch((err) => {
        onError(err instanceof Error ? err.message : "Error al iniciar con Google.");
      });
    } else if (response?.type === "error") {
      onError("No se pudo completar el inicio de sesión con Google.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <TouchableOpacity
      style={styles.button}
      disabled={!request || disabled}
      onPress={() => promptAsync()}
    >
      <Text style={styles.text}>Continuar con Google</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  text: { color: colors.ink, fontWeight: "700", fontSize: 14 },
});
