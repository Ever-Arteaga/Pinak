import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, themedStyles } from "../theme";
import { useNav, type Screen } from "../nav";

const TABS: { screen: Screen | "more"; label: string; icon: string }[] = [
  { screen: "dashboard", label: "Inicio", icon: "▦" },
  { screen: "receivables", label: "Fiados", icon: "👥" },
  { screen: "reports", label: "Reportes", icon: "📊" },
  { screen: "more", label: "Más", icon: "☰" },
];

/** Barra inferior: Inicio · Fiados · [+] · Reportes · Más. */
export function BottomNav() {
  const { screen, go, openMenu, requestAdd } = useNav();

  function tab(t: (typeof TABS)[number]) {
    const active = t.screen === screen;
    return (
      <TouchableOpacity
        key={t.screen}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={t.label}
        onPress={() => (t.screen === "more" ? openMenu() : go(t.screen))}
      >
        <Text style={[styles.icon, active && styles.active]}>{t.icon}</Text>
        <Text style={[styles.label, active && styles.active]}>{t.label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.bar}>
      {tab(TABS[0])}
      {tab(TABS[1])}
      <View style={styles.tab}>
        <TouchableOpacity
          style={styles.plus}
          accessibilityRole="button"
          accessibilityLabel="Registrar movimiento"
          onPress={requestAdd}
        >
          <Text style={styles.plusText}>+</Text>
        </TouchableOpacity>
      </View>
      {tab(TABS[2])}
      {tab(TABS[3])}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingBottom: 10,
      paddingTop: 6,
    },
    tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48 },
    icon: { fontSize: 18, color: colors.inkSoft },
    label: { fontSize: 11, fontWeight: "600", color: colors.inkSoft, marginTop: 2 },
    active: { color: colors.title, fontWeight: "700" },
    plus: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.green600,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -22,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    plusText: { color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "500" },
  })
);
