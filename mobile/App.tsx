import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuthUser } from "./src/lib/auth";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ReceivablesScreen from "./src/screens/ReceivablesScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import UpgradeScreen from "./src/screens/UpgradeScreen";
import { colors } from "./src/theme";

type Screen = "dashboard" | "receivables" | "reports" | "upgrade";

export default function App() {
  const { user, loading } = useAuthUser();
  const [screen, setScreen] = useState<Screen>("dashboard");

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.navy900} size="large" />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!user && <LoginScreen />}
      {user && screen === "dashboard" && (
        <DashboardScreen
          onOpenReceivables={() => setScreen("receivables")}
          onOpenReports={() => setScreen("reports")}
          onOpenUpgrade={() => setScreen("upgrade")}
        />
      )}
      {user && screen === "receivables" && (
        <ReceivablesScreen onBack={() => setScreen("dashboard")} />
      )}
      {user && screen === "reports" && (
        <ReportsScreen onBack={() => setScreen("dashboard")} />
      )}
      {user && screen === "upgrade" && (
        <UpgradeScreen onBack={() => setScreen("dashboard")} />
      )}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
});
