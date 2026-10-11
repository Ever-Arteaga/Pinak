import { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle, StyleProp } from "react-native";
import { colors, themedStyles } from "../theme";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.cardTitle}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  disabled,
  kind = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: "primary" | "ghost" | "danger";
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, kind === "ghost" && styles.btnGhost, kind === "danger" && styles.btnDanger, disabled && { opacity: 0.6 }]}
    >
      <Text style={[styles.btnText, kind !== "primary" && { color: kind === "danger" ? colors.danger : colors.title }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.inkSoft} {...props} />
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function InfoText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.info}>{children}</Text>;
}

export function Spinner() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
      <ActivityIndicator color={colors.title} size="large" />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, marginBottom: 12 },
    cardTitle: { fontSize: 14, fontWeight: "700", color: colors.title, marginBottom: 8 },
    muted: { fontSize: 12.5, color: colors.inkSoft },
    btn: { backgroundColor: colors.navy900, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 6 },
    btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
    btnDanger: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
    btnText: { color: colors.onNavy, fontWeight: "700", fontSize: 14 },
    label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.ink,
      backgroundColor: colors.input,
    },
    error: { color: colors.danger, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 },
    info: { color: colors.green600, backgroundColor: colors.green100, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 },
  })
);
