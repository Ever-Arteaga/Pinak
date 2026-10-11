import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import { InvitationsBanner, VerifyEmailCard } from "../components/InvitationsBanner";
import { Button, Card, CardTitle, ErrorText, Field, Muted, Spinner } from "../components/ui";
import { useAuthUser } from "../lib/auth";
import { useBusiness } from "../lib/business";
import { createBusiness } from "../lib/businessApi";
import { useNav } from "../nav";
import { colors, themedStyles } from "../theme";
import { BUSINESS_TYPES, PLAN_LIMITS, PLAN_NAMES } from "../types/pinak";

export default function BusinessesScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuthUser();
  const { business, businesses, loading, switchBusiness } = useBusiness();
  const nav = useNav();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || loading) return <Spinner />;

  const owned = businesses.filter((b) => b.ownerId === user.uid);
  const ownPlan = owned[0]?.plan ?? "emprendedor";
  const canCreate = PLAN_LIMITS[ownPlan].businesses > owned.length;

  async function create() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Escribe el nombre del negocio.");
      return;
    }
    setBusy(true);
    try {
      const { businessId } = await createBusiness({ name, businessType: type, city });
      switchBusiness(businessId);
      nav.go("dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <AppHeader onBack={onBack} backLabel="Dashboard" title="Negocios" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <InvitationsBanner />
        <VerifyEmailCard />

        <Card style={{ marginTop: 12 }}>
          <CardTitle>Mis negocios</CardTitle>
          {businesses.map((b) => {
            const active = b.id === business?.id;
            return (
              <View key={b.id} style={[styles.item, active && styles.itemActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {b.name} {b.locked ? "🔒" : ""}
                  </Text>
                  <Muted>
                    {b.ownerId === user.uid ? "Dueño" : "Miembro"} · Plan {PLAN_NAMES[b.plan]} · {b.members.length}{" "}
                    {b.members.length === 1 ? "persona" : "personas"}
                  </Muted>
                </View>
                {active ? (
                  <Text style={styles.active}>Activo</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.open}
                    onPress={() => {
                      switchBusiness(b.id);
                      nav.go("dashboard");
                    }}
                  >
                    <Text style={styles.openText}>Abrir</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </Card>

        <Card>
          <CardTitle>Agregar un negocio</CardTitle>
          {canCreate ? (
            <>
              <Field label="Nombre del negocio" value={name} onChangeText={setName} placeholder="Ej. Sucursal Centro" maxLength={80} />
              <Text style={styles.label}>Tipo de negocio</Text>
              <View style={styles.chips}>
                {BUSINESS_TYPES.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setType(t === type ? "" : t)} style={[styles.chip, type === t && styles.chipActive]}>
                    <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Ciudad" value={city} onChangeText={setCity} placeholder="Ej. Cartagena" />
              <ErrorText>{error}</ErrorText>
              <Button label={busy ? "Creando..." : "Crear negocio"} onPress={create} disabled={busy} />
            </>
          ) : (
            <>
              <Muted>Tu plan incluye 1 negocio. Con el plan Premium puedes administrar varios.</Muted>
              <Button label="Ver planes" onPress={() => nav.go("upgrade")} kind="ghost" />
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    content: { padding: 16, paddingBottom: 60 },
    item: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, marginBottom: 8 },
    itemActive: { backgroundColor: colors.green100, borderColor: colors.green600 },
    itemName: { fontSize: 14, fontWeight: "700", color: colors.title },
    active: { color: colors.green600, fontWeight: "700", fontSize: 12 },
    open: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.white },
    openText: { color: colors.title, fontWeight: "700", fontSize: 12 },
    label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
    chipActive: { backgroundColor: colors.green100, borderColor: colors.green600 },
    chipText: { fontSize: 12, color: colors.inkSoft },
    chipTextActive: { color: colors.title, fontWeight: "700" },
  })
);
