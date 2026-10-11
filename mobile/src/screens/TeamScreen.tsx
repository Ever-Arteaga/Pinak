import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import { useBusinessGate } from "../components/BusinessGate";
import { Button, Card, CardTitle, ErrorText, Field, InfoText, Muted } from "../components/ui";
import { useAuthUser } from "../lib/auth";
import { useBusiness, useSentInvitations } from "../lib/business";
import { cancelInvite, inviteMember, removeMember } from "../lib/businessApi";
import { useNav } from "../nav";
import { colors, themedStyles } from "../theme";
import { PLAN_LIMITS } from "../types/pinak";

export default function TeamScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuthUser();
  const { business, businesses, isOwner, switchBusiness } = useBusiness();
  const sent = useSentInvitations(business?.id, user?.uid);
  const nav = useNav();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  const limit = PLAN_LIMITS[biz.plan].users;
  const limitText = Number.isFinite(limit) ? String(limit) : "ilimitados";
  const used = biz.members.length + sent.length;
  const full = Number.isFinite(limit) && used >= limit;

  async function invite() {
    setError(null);
    setInfo(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Escribe un correo válido.");
      return;
    }
    setBusy(true);
    try {
      await inviteMember({ businessId: biz.id, email });
      setInfo(`Invitación enviada a ${email.trim().toLowerCase()}.`);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirm(title: string, message: string, action: () => Promise<void>) {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await action();
          } catch (err) {
            setError((err as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <AppHeader onBack={onBack} backLabel="Dashboard" title="Equipo" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.row}>
            <CardTitle>Personas en {biz.name}</CardTitle>
            <Muted>
              {biz.members.length} de {limitText}
            </Muted>
          </View>
          {biz.members.map((m) => (
            <View key={m.uid} style={styles.member}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {m.email || "Sin correo"}
                  {m.uid === user?.uid ? " (tú)" : ""}
                </Text>
                <Muted>{m.role === "owner" ? "Dueño" : "Miembro"}</Muted>
              </View>
              {isOwner && m.role !== "owner" && (
                <TouchableOpacity
                  onPress={() =>
                    confirm("Quitar persona", `¿Quitar a ${m.email || "esta persona"} de este negocio?`, () =>
                      removeMember({ businessId: biz.id, memberUid: m.uid }).then(() => undefined)
                    )
                  }
                >
                  <Text style={styles.danger}>Quitar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {!isOwner && (
            <Button
              kind="danger"
              label="Salir de este negocio"
              onPress={() =>
                confirm("Salir del negocio", `¿Salir de ${biz.name}? Dejarás de ver sus datos.`, async () => {
                  await removeMember({ businessId: biz.id, memberUid: user!.uid });
                  const own = businesses.find((b) => b.ownerId === user!.uid);
                  if (own) switchBusiness(own.id);
                  nav.go("dashboard");
                })
              }
            />
          )}
        </Card>

        {sent.length > 0 && isOwner && (
          <Card>
            <CardTitle>Invitaciones pendientes</CardTitle>
            {sent.map((inv) => (
              <View key={inv.id} style={styles.member}>
                <Text style={[styles.memberEmail, { flex: 1 }]} numberOfLines={1}>
                  {inv.email}
                </Text>
                <TouchableOpacity onPress={() => cancelInvite({ inviteId: inv.id }).catch((e) => setError((e as Error).message))}>
                  <Text style={styles.danger}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {isOwner && (
          <Card>
            <CardTitle>Invitar a alguien</CardTitle>
            {full ? (
              <>
                <Muted>
                  Tu plan permite {limitText} {limit === 1 ? "usuario" : "usuarios"}, contándote a ti.
                </Muted>
                <Button label="Ver planes" onPress={() => nav.go("upgrade")} kind="ghost" />
              </>
            ) : (
              <>
                <Field label="Correo de la persona" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="correo@ejemplo.com" />
                <Muted style={{ marginBottom: 8 }}>
                  Recibirá la invitación al abrir PINAK con ese correo (debe tenerlo verificado).
                </Muted>
                <Button label={busy ? "Enviando..." : "Enviar invitación"} onPress={invite} disabled={busy} />
              </>
            )}
          </Card>
        )}
        <ErrorText>{error}</ErrorText>
        <InfoText>{info}</InfoText>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    content: { padding: 16, paddingBottom: 60 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    member: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
    memberEmail: { fontSize: 14, fontWeight: "600", color: colors.ink },
    danger: { color: colors.danger, fontWeight: "700", fontSize: 12.5 },
  })
);
