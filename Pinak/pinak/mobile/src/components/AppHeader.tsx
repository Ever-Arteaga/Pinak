import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../theme";

export function AppHeader({
  onBack,
  backLabel = "Atrás",
  title,
  onLogout,
}: {
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  onLogout?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={8}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>{backLabel}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.logo}>PINAK</Text>
        )}
      </View>

      {title && (
        <View style={styles.centerTitleWrap} pointerEvents="none">
          <Text style={styles.centerTitle}>{title}</Text>
        </View>
      )}

      <View style={[styles.side, styles.sideRight]}>
        {onLogout && (
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout} hitSlop={8}>
            <Text style={styles.logoutIcon}>⏻</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  side: { minWidth: 60, flexShrink: 0 },
  sideRight: { alignItems: "flex-end" },
  logo: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy900,
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 2,
  },
  backArrow: { fontSize: 22, color: colors.inkSoft, fontWeight: "600", lineHeight: 22 },
  backLabel: { fontSize: 14, color: colors.inkSoft, fontWeight: "600" },
  centerTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  centerTitle: { fontSize: 15, fontWeight: "700", color: colors.navy900 },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fdf0ee",
  },
  logoutIcon: { fontSize: 15, color: colors.danger },
});
