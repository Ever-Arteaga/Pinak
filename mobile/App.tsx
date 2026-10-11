import { useMemo, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { useAuthUser } from "./src/lib/auth";
import { BusinessProvider } from "./src/lib/business";
import { MenuDrawer } from "./src/components/MenuDrawer";
import { Spinner } from "./src/components/ui";
import { NavContext, type Screen } from "./src/nav";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import ReceivablesScreen from "./src/screens/ReceivablesScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import UpgradeScreen from "./src/screens/UpgradeScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import TeamScreen from "./src/screens/TeamScreen";
import BusinessesScreen from "./src/screens/BusinessesScreen";
import DiagnosisScreen from "./src/screens/DiagnosisScreen";
import { ThemeProvider, themedStyles, useTheme } from "./src/theme";

function Root() {
  const { user, loading } = useAuthUser();
  const { mode } = useTheme();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [menu, setMenu] = useState(false);
  const nav = useMemo(() => ({ screen, go: setScreen, openMenu: () => setMenu(true) }), [screen]);
  const back = () => setScreen("dashboard");
  const bar = mode === "dark" ? "light" : "dark";

  if (loading) {
    return (
      <View style={styles.container}>
        <Spinner />
        <StatusBar style={bar} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <LoginScreen />
        <StatusBar style={bar} />
      </View>
    );
  }

  return (
    <BusinessProvider>
      <NavContext.Provider value={nav}>
        <View style={styles.container}>
          {screen === "dashboard" && (
            <DashboardScreen
              onOpenReceivables={() => setScreen("receivables")}
              onOpenReports={() => setScreen("reports")}
              onOpenUpgrade={() => setScreen("upgrade")}
            />
          )}
          {screen === "receivables" && <ReceivablesScreen onBack={back} />}
          {screen === "reports" && <ReportsScreen onBack={back} />}
          {screen === "upgrade" && <UpgradeScreen onBack={back} />}
          {screen === "profile" && <ProfileScreen onBack={back} />}
          {screen === "team" && <TeamScreen onBack={back} />}
          {screen === "businesses" && <BusinessesScreen onBack={back} />}
          {screen === "diagnosis" && <DiagnosisScreen onBack={back} />}
          <MenuDrawer open={menu} onClose={() => setMenu(false)} current={screen} onGo={(s) => { setScreen(s); setMenu(false); }} />
          <StatusBar style={bar} />
        </View>
      </NavContext.Provider>
    </BusinessProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}

const styles = themedStyles(() => StyleSheet.create({ container: { flex: 1, backgroundColor: "#f6f4ee" } }));
