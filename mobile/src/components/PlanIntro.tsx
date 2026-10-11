import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getItem, setItem } from "../lib/storage";
import { PLAN_LIMITS } from "../types/pinak";
import { themedStyles } from "../theme";

const KEY_SEEN = "pinak.intro.seen";
const KEY_PLAN = "pinak.intro.plan";

export async function readIntroPlan(): Promise<string | null> {
  return getItem(KEY_PLAN);
}

const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const PLANES = [
  { id: "emprendedor", nombre: "Emprendedor", precio: "Gratis", items: ["Ingresos, egresos y fiados", "Reportes del mes", "1 usuario"] },
  {
    id: "pro",
    nombre: "Pro",
    precio: `${cop(PLAN_LIMITS.pro.priceCOP)}/mes`,
    items: ["Registro con IA por voz y texto", "2 usuarios", "Exporta a PDF y Excel"],
    destacado: true,
  },
  {
    id: "premium",
    nombre: "Premium",
    precio: `${cop(PLAN_LIMITS.premium.priceCOP)}/mes`,
    items: ["Todo lo de Pro", "Varios negocios y usuarios", "Diagnóstico financiero con IA", "Modo privacidad"],
  },
];

/** Bienvenida para quien abre la app por primera vez: tres tarjetas con los planes. */
export function PlanIntro({ onChoose }: { onChoose: (plan: string) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getItem(KEY_SEEN).then((v) => {
      if (!v) setOpen(true);
    });
  }, []);

  async function choose(id: string) {
    await setItem(KEY_SEEN, "1");
    await setItem(KEY_PLAN, id);
    setOpen(false);
    onChoose(id);
  }
  async function skip() {
    await setItem(KEY_SEEN, "1");
    setOpen(false);
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={skip}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Elige el plan para tu negocio</Text>
          <Text style={styles.sub}>Puedes cambiarlo cuando quieras. Luego crea tu cuenta o inicia sesión.</Text>
          {PLANES.map((p) => (
            <TouchableOpacity key={p.id} style={[styles.card, p.destacado && styles.cardHot]} onPress={() => choose(p.id)} activeOpacity={0.85}>
              {p.destacado && <Text style={styles.badge}>Más popular</Text>}
              <Text style={styles.name}>{p.nombre}</Text>
              <Text style={styles.price}>{p.precio}</Text>
              {p.items.map((it) => (
                <Text key={it} style={styles.item}>
                  ✓ {it}
                </Text>
              ))}
              <Text style={styles.cta}>Elegir {p.nombre}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={skip}>
            <Text style={styles.skip}>Ya tengo cuenta</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#10123a" },
    scroll: { padding: 22, paddingTop: 60 },
    title: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" },
    sub: { color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 20 },
    card: { backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
    cardHot: { borderWidth: 2, borderColor: "#5fa17e" },
    badge: { alignSelf: "flex-start", backgroundColor: "#dcece2", color: "#10123a", fontSize: 11, fontWeight: "700", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6, overflow: "hidden" },
    name: { fontSize: 18, fontWeight: "700", color: "#10123a" },
    price: { fontSize: 14, fontWeight: "700", color: "#4c8c6b", marginTop: 2, marginBottom: 10 },
    item: { fontSize: 13.5, color: "#5c5f72", marginBottom: 4 },
    cta: { marginTop: 12, backgroundColor: "#10123a", color: "#fff", textAlign: "center", fontWeight: "700", paddingVertical: 11, borderRadius: 10, overflow: "hidden" },
    skip: { color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 8, fontSize: 14 },
  })
);
