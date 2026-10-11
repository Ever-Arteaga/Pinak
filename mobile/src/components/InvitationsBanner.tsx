import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { sendEmailVerification } from "firebase/auth";
import { useAuthUser } from "../lib/auth";
import { useBusiness, useMyInvitations } from "../lib/business";
import { acceptInvite, declineInvite } from "../lib/businessApi";
import { colors, themedStyles } from "../theme";
import { Card, CardTitle, ErrorText, Muted, Button } from "./ui";

/** Invitaciones a otros negocios que la persona puede aceptar o rechazar. */
export function InvitationsBanner() {
  const { user } = useAuthUser();
  const { switchBusiness } = useBusiness();
  const invitations = useMyInvitations(user?.email, user?.emailVerified === true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function accept(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const { businessId } = await acceptInvite({ inviteId: id });
      switchBusiness(businessId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  async function decline(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await declineInvite({ inviteId: id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ marginTop: 12 }}>
      {invitations.map((inv) => (
        <View key={inv.id} style={styles.box}>
          <Text style={styles.text}>
            <Text style={styles.bold}>{inv.invitedByEmail || "Alguien"}</Text> te invitó a unirte a{" "}
            <Text style={styles.bold}>{inv.businessName}</Text>.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.accept} disabled={busyId === inv.id} onPress={() => accept(inv.id)}>
              <Text style={styles.acceptText}>Aceptar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.decline} disabled={busyId === inv.id} onPress={() => decline(inv.id)}>
              <Text style={styles.declineText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

/** Para recibir invitaciones hace falta tener el correo verificado. */
export function VerifyEmailCard() {
  const { user } = useAuthUser();
  const [sent, setSent] = useState(false);
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  async function send() {
    setError(null);
    try {
      await sendEmailVerification(user!);
      setSent(true);
    } catch {
      setError("No se pudo enviar el correo. Intenta de nuevo en unos minutos.");
    }
  }
  async function checked() {
    setError(null);
    await user!.reload();
    await user!.getIdToken(true);
    force((n) => n + 1);
    if (!user!.emailVerified) setError("Todavía no aparece como verificado. Abre el enlace del correo y vuelve a intentar.");
  }

  return (
    <Card>
      <CardTitle>Verifica tu correo</CardTitle>
      <Muted>Para recibir invitaciones a otros negocios necesitamos confirmar que {user.email} es tuyo.</Muted>
      <View style={{ marginTop: 8 }}>
        <Button label={sent ? "Reenviar correo" : "Enviar correo de verificación"} onPress={send} kind="ghost" />
        {sent && <Button label="Ya lo verifiqué" onPress={checked} />}
      </View>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    box: { backgroundColor: colors.green100, borderRadius: 14, padding: 14, marginBottom: 10 },
    text: { fontSize: 13.5, color: colors.title },
    bold: { fontWeight: "700" },
    row: { flexDirection: "row", gap: 8, marginTop: 10 },
    accept: { backgroundColor: colors.navy900, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
    acceptText: { color: colors.onNavy, fontWeight: "700", fontSize: 12 },
    decline: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
    declineText: { color: colors.title, fontWeight: "700", fontSize: 12 },
  })
);
