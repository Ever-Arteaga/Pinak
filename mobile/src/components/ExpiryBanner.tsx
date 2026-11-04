import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { expiryNotice } from "@pinak/shared/expiryNotice";
import { useAuthUser } from "../lib/auth";
import { getItem, setItem } from "../lib/storage";
import { useUserProfile } from "../lib/userProfile";
import { useNav } from "../nav";
import { colors, themedStyles } from "../theme";

/** Aviso a 7, 3 y 1 día del vencimiento del plan. Se puede cerrar; reaparece en el siguiente escalón. */
export function ExpiryBanner() {
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const nav = useNav();
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const storageKey = user ? `pinak.expiryDismiss.${user.uid}` : null;

  useEffect(() => {
    if (!storageKey) return;
    void getItem(storageKey).then(setClosedKey);
  }, [storageKey]);

  const notice = profile
    ? expiryNotice({
        plan: profile.plan,
        planTrial: profile.planTrial,
        expiresMs: profile.planExpiresAt ? profile.planExpiresAt.getTime() : null,
      })
    : null;
  if (!notice || notice.key === closedKey) return null;

  function close() {
    if (!notice) return;
    setClosedKey(notice.key);
    if (storageKey) void setItem(storageKey, notice.key);
  }

  return (
    <View style={[styles.box, notice.level === 1 && styles.boxUrgent]}>
      <Text style={styles.title}>{notice.title}</Text>
      <Text style={styles.body}>{notice.body}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.primary} onPress={() => nav.go("upgrade")}>
          <Text style={styles.primaryText}>{profile?.planTrial ? "Elegir plan" : "Renovar"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghost} onPress={close}>
          <Text style={styles.ghostText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    box: { borderWidth: 1, borderColor: colors.green600, backgroundColor: colors.green100, borderRadius: 16, padding: 14, marginBottom: 12 },
    boxUrgent: { borderColor: colors.danger },
    title: { fontSize: 14, fontWeight: "700", color: colors.title },
    body: { fontSize: 13, color: colors.inkSoft, marginTop: 4 },
    row: { flexDirection: "row", gap: 8, marginTop: 12 },
    primary: { backgroundColor: colors.navy900, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
    primaryText: { color: colors.onNavy, fontWeight: "700", fontSize: 12 },
    ghost: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
    ghostText: { color: colors.title, fontWeight: "700", fontSize: 12 },
  })
);
