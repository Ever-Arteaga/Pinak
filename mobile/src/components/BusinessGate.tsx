import { Text, View } from "react-native";
import { useBusiness } from "../lib/business";
import { colors } from "../theme";
import { Button, Spinner } from "./ui";

/** Devuelve una pantalla de carga/error mientras el negocio no esté listo; null cuando ya se puede mostrar la pantalla. */
export function useBusinessGate() {
  const { business, loading, error, retry } = useBusiness();
  if (error && !business) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.cream }}>
        <Text style={{ color: colors.danger, textAlign: "center", marginBottom: 12 }}>{error}</Text>
        <Button label="Reintentar" onPress={retry} />
      </View>
    );
  }
  if (loading || !business) return <Spinner />;
  return null;
}
