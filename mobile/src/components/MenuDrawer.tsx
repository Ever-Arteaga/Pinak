import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { logoutUser } from "../lib/auth";
import { useBusiness } from "../lib/business";
import { usePrivacy } from "../lib/privacy";
import { Screen } from "../nav";
import { colors, themedStyles, useTheme } from "../theme";
import { PLAN_NAMES } from "../types/pinak";

const ITEMS: { screen: Screen; label: string; icon: string }[] = [
  { screen: "dashboard", label: "Dashboard", icon: "▦" },
  { screen: "receivables", label: "Fiados", icon: "👥" },
  { screen: "reports", label: "Reportes", icon: "📊" },
  { screen: "diagnosis", label: "Diagnóstico IA", icon: "🩺" },
  { screen: "team", label: "Equipo", icon: "🤝" },
  { screen: "businesses", label: "Negocios", icon: "🏪" },
  { screen: "profile", label: "Mi perfil", icon: "🏢" },
  { screen: "upgrade", label: "Planes", icon: "⭐" },
];

export function MenuDrawer({
  open,
  onClose,
  current,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  current: Screen;
  onGo: (s: Screen) => void;
}) {
  const { business, businesses, switchBusiness } = useBusiness();
  const { available, enabled, toggle } = usePrivacy();
  const { mode, toggle: toggleTheme } = useTheme();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.panel}>
          <ScrollView>
            <Text style={styles.logo}>PINAK</Text>

            {business && (
              <View style={styles.bizBox}>
                <Text style={styles.bizLabel}>Negocio activo</Text>
                <Text style={styles.bizName} numberOfLines={1}>
                  {business.name}
                </Text>
                <Text style={styles.bizPlan}>Plan {PLAN_NAMES[business.plan]}</Text>
                {businesses.length > 1 &&
                  businesses
                    .filter((b) => b.id !== business.id)
                    .map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={styles.switchRow}
                        onPress={() => {
                          switchBusiness(b.id);
                          onClose();
                        }}
                      >
                        <Text style={styles.switchText} numberOfLines={1}>
                          ↔ {b.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
              </View>
            )}

            {ITEMS.map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={[styles.item, current === item.screen && styles.itemActive]}
                onPress={() => {
                  onGo(item.screen);
                  onClose();
                }}
              >
                <Text style={styles.itemIcon}>{item.icon}</Text>
                <Text style={styles.itemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            {available && (
              <TouchableOpacity style={styles.item} onPress={() => toggle()}>
                <Text style={styles.itemIcon}>{enabled ? "👁️" : "🙈"}</Text>
                <Text style={styles.itemText}>{enabled ? "Mostrar montos" : "Ocultar montos"}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.item} onPress={toggleTheme}>
              <Text style={styles.itemIcon}>{mode === "dark" ? "☀️" : "🌙"}</Text>
              <Text style={styles.itemText}>{mode === "dark" ? "Modo claro" : "Modo oscuro"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onClose();
                logoutUser();
              }}
            >
              <Text style={styles.itemIcon}>⏻</Text>
              <Text style={[styles.itemText, { color: colors.danger }]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    root: { flex: 1, flexDirection: "row" },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
    panel: { width: 290, maxWidth: "82%", backgroundColor: colors.white, paddingTop: 48, paddingHorizontal: 12 },
    logo: { fontSize: 20, fontWeight: "700", color: colors.title, letterSpacing: 1, paddingHorizontal: 8, marginBottom: 12 },
    bizBox: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, marginBottom: 10 },
    bizLabel: { fontSize: 10.5, color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
    bizName: { fontSize: 14, fontWeight: "700", color: colors.title, marginTop: 2 },
    bizPlan: { fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
    switchRow: { marginTop: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
    switchText: { fontSize: 13, color: colors.green600, fontWeight: "600" },
    item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
    itemActive: { backgroundColor: colors.green100 },
    itemIcon: { fontSize: 16, width: 22, textAlign: "center", color: colors.inkSoft },
    itemText: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  })
);
