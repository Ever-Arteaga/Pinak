import AsyncStorage from "@react-native-async-storage/async-storage";

/** Lectura/escritura segura: si el almacenamiento falla, la app sigue funcionando. */
export async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* se ignora */
  }
}
