import { useEffect, useState } from "react";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AppHeader } from "../components/AppHeader";
import { useBusinessGate } from "../components/BusinessGate";
import { Button, Card, CardTitle, ErrorText, Field, InfoText, Muted } from "../components/ui";
import { logoutUser, reauthWithPassword, useAuthUser, usesPassword } from "../lib/auth";
import { deleteAccount } from "../lib/businessApi";
import { updateBusinessPhoto, updateBusinessProfile, useBusiness } from "../lib/business";
import { useNav } from "../nav";
import { colors, themedStyles } from "../theme";
import { BUSINESS_TYPES, PLAN_LIMITS, PLAN_NAMES } from "../types/pinak";

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { business, isOwner } = useBusiness();
  const { user } = useAuthUser();
  const nav = useNav();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [nit, setNit] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delPhrase, setDelPhrase] = useState("");
  const [delPassword, setDelPassword] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  useEffect(() => {
    if (!business) return;
    setName(business.name);
    setType(business.businessType);
    setPhone(business.phone);
    setCity(business.city);
    setNit(business.nit);
    setDescription(business.description);
  }, [business?.id, business?.name, business?.businessType, business?.phone, business?.city, business?.nit, business?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  const gate = useBusinessGate();
  if (gate) return gate;
  const biz = business!;

  const delPassMode = !!user && usesPassword(user);
  const delReady = delPhrase.trim().toUpperCase() === "ELIMINAR" && (!delPassMode || delPassword.length > 0);

  function closeDelete() {
    setDelOpen(false);
    setDelPhrase("");
    setDelPassword("");
    setDelError(null);
  }

  function askDelete() {
    if (!user || !delReady || delBusy) return;
    Alert.alert(
      "¿Eliminar tu cuenta?",
      personal ? "Se borrarán para siempre tu cuenta y todos tus datos. No se puede deshacer." : "Se borrarán para siempre tu cuenta y tus negocios con todos sus datos. No se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => void runDelete() },
      ]
    );
  }

  async function runDelete() {
    if (!user) return;
    setDelBusy(true);
    setDelError(null);
    try {
      if (delPassMode) await reauthWithPassword(user, delPassword);
      await deleteAccount({ confirmation: delPhrase });
      await logoutUser().catch(() => {});
    } catch (err) {
      setDelError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
      setDelBusy(false);
    }
  }

  async function pickPhoto() {
    setError(null);
    setPhotoBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Da permiso a tus fotos para elegir una imagen.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (res.canceled || !res.assets[0]) return;
      const out = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!out.base64) throw new Error("sin datos");
      await updateBusinessPhoto(biz.id, `data:image/jpeg;base64,${out.base64}`);
    } catch {
      setError("No se pudo guardar la foto. Intenta con otra imagen.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setError(null);
    setPhotoBusy(true);
    try {
      await updateBusinessPhoto(biz.id, null);
    } catch {
      setError("No se pudo quitar la foto.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (name.trim().length < 2) {
      setError(personal ? "El nombre de tu cuenta es muy corto." : "El nombre del negocio es muy corto.");
      return;
    }
    setSaving(true);
    try {
      await updateBusinessProfile(biz.id, {
        name: name.trim(),
        businessType: type,
        phone: phone.trim(),
        city: city.trim(),
        nit: nit.trim(),
        description: description.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const price = PLAN_LIMITS[biz.plan].priceCOP;
  const personal = biz.plan === "essential";

  return (
    <View style={styles.container}>
      <AppHeader onBack={onBack} backLabel="Dashboard" title="Perfil de la empresa" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={styles.headRow}>
              <View style={styles.avatar}>
                {biz.photoURL ? (
                  <Image source={{ uri: biz.photoURL }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{(name || "?").trim().slice(0, 2).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headName} numberOfLines={1}>
                  {name || (personal ? "Tu cuenta" : "Tu negocio")}
                </Text>
                <Muted>{user?.email}</Muted>
                {isOwner && (
                  <View style={styles.photoRow}>
                    <TouchableOpacity onPress={pickPhoto} disabled={photoBusy} style={styles.planBtn}>
                      <Text style={styles.planBtnText}>
                        {photoBusy ? "Guardando..." : biz.photoURL ? "Cambiar foto" : "Subir foto"}
                      </Text>
                    </TouchableOpacity>
                    {!!biz.photoURL && !photoBusy && (
                      <TouchableOpacity onPress={removePhoto} style={styles.planBtn}>
                        <Text style={[styles.planBtnText, { color: colors.danger }]}>Quitar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </Card>

          <Card>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Muted>Plan actual</Muted>
                <Text style={styles.plan}>
                  {PLAN_NAMES[biz.plan]}
                  {price > 0 ? ` · $${price.toLocaleString("es-CO")}/mes` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => nav.go("upgrade")} style={styles.planBtn}>
                <Text style={styles.planBtnText}>Cambiar plan</Text>
              </TouchableOpacity>
            </View>
          </Card>

          <Card>
            <CardTitle>{personal ? "Datos de tu cuenta" : "Datos del negocio"}</CardTitle>
            {!isOwner && <Muted style={{ marginBottom: 8 }}>Solo el dueño puede editar estos datos.</Muted>}
            <Field label={personal ? "Tu nombre" : "Nombre del negocio"} value={name} onChangeText={setName} editable={isOwner} placeholder={personal ? "Ej. María Pérez" : "Ej. Tienda Doña Rosa"} maxLength={80} />
            {!personal && <Text style={styles.label}>Tipo de negocio</Text>}
            {!personal && <View style={styles.chips}>
              {BUSINESS_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  disabled={!isOwner}
                  onPress={() => setType(t === type ? "" : t)}
                  style={[styles.chip, type === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>}
            <Field label="Teléfono" value={phone} onChangeText={setPhone} editable={isOwner} keyboardType="phone-pad" placeholder="Ej. 3001234567" />
            <Field label="Ciudad" value={city} onChangeText={setCity} editable={isOwner} placeholder="Ej. Cartagena" />
            <Field label={personal ? "Cédula (opcional)" : "NIT o documento (opcional)"} value={nit} onChangeText={setNit} editable={isOwner} placeholder="Ej. 901234567-8" />
            {!personal && <Field label="Descripción breve (opcional)" value={description} onChangeText={setDescription} editable={isOwner} multiline placeholder="¿A qué se dedica tu negocio?" />}
            <ErrorText>{error}</ErrorText>
            <InfoText>{saved ? "Perfil actualizado." : null}</InfoText>
            {isOwner && <Button label={saving ? "Guardando..." : "Guardar cambios"} onPress={save} disabled={saving} />}
          </Card>

          <Card>
            <CardTitle>Eliminar cuenta</CardTitle>
            <Muted style={{ marginBottom: 8 }}>
              {personal ? "Borra para siempre tu cuenta con todos tus movimientos, fiados y categorías. No se puede deshacer y no hay reembolso del plan." : "Borra para siempre tu cuenta y tus negocios, con sus movimientos, fiados y categorías. Tu equipo perderá el acceso. No se puede deshacer y no hay reembolso del plan."}
            </Muted>
            {!delOpen ? (
              <Button label="Eliminar mi cuenta" kind="danger" onPress={() => setDelOpen(true)} />
            ) : (
              <>
                <Field label="Escribe ELIMINAR para confirmar" value={delPhrase} onChangeText={setDelPhrase} autoCapitalize="characters" autoCorrect={false} />
                {delPassMode ? (
                  <Field label="Tu contraseña" value={delPassword} onChangeText={setDelPassword} secureTextEntry autoCapitalize="none" />
                ) : (
                  <Muted style={{ marginBottom: 8 }}>
                    Si entraste con Google y tu sesión no es reciente, cierra sesión, vuelve a entrar y repite esto.
                  </Muted>
                )}
                <ErrorText>{delError}</ErrorText>
                <Button label={delBusy ? "Eliminando..." : "Eliminar definitivamente"} kind="danger" onPress={askDelete} disabled={!delReady || delBusy} />
                <Button label="Cancelar" kind="ghost" onPress={closeDelete} disabled={delBusy} />
              </>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    content: { padding: 16, paddingBottom: 60 },
    headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.navy900, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarImg: { width: 64, height: 64 },
    photoRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    avatarText: { color: colors.onNavy, fontWeight: "700", fontSize: 16 },
    headName: { fontSize: 16, fontWeight: "700", color: colors.title },
    plan: { fontSize: 14, fontWeight: "700", color: colors.title, marginTop: 2 },
    planBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    planBtnText: { color: colors.title, fontWeight: "700", fontSize: 12 },
    label: { fontSize: 13, fontWeight: "600", color: colors.ink, marginBottom: 6 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
    chipActive: { backgroundColor: colors.green100, borderColor: colors.green600 },
    chipText: { fontSize: 12, color: colors.inkSoft },
    chipTextActive: { color: colors.title, fontWeight: "700" },
  })
);
