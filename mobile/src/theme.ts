import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Appearance } from "react-native";
import { getItem, setItem } from "./lib/storage";

export interface Palette {
  navy900: string; // fondos de marca (botones, tarjetas)
  navy800: string;
  title: string; // títulos y texto de marca
  onNavy: string; // texto sobre fondos de marca
  green600: string;
  green500: string;
  green100: string;
  cream: string; // fondo de pantalla
  ink: string;
  inkSoft: string;
  line: string;
  danger: string;
  dangerBg: string;
  white: string; // fondo de tarjetas
  input: string;
}

const light: Palette = {
  navy900: "#10123a",
  navy800: "#171a4d",
  title: "#10123a",
  onNavy: "#ffffff",
  green600: "#4c8c6b",
  green500: "#5fa17e",
  green100: "#dcece2",
  cream: "#f7f7f4",
  ink: "#1b1c29",
  inkSoft: "#5c5f72",
  line: "#e4e3dd",
  danger: "#b3503f",
  dangerBg: "#fdf0ee",
  white: "#ffffff",
  input: "#ffffff",
};

const dark: Palette = {
  navy900: "#2f3590",
  navy800: "#3a41a8",
  title: "#e9ebf7",
  onNavy: "#ffffff",
  green600: "#7cc29d",
  green500: "#7cc29d",
  green100: "#1c3a2d",
  cream: "#0c0e1f",
  ink: "#e9ebf7",
  inkSoft: "#a3a7c2",
  line: "#2a2e52",
  danger: "#e8836f",
  dangerBg: "#3a1d1d",
  white: "#161933",
  input: "#11142b",
};

export type Mode = "light" | "dark";
const palettes: Record<Mode, Palette> = { light, dark };
let current: Mode = Appearance.getColorScheme() === "dark" ? "dark" : "light";

/** Paleta vigente; se lee al dibujar, así cambia al alternar el modo. */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_t, key) => palettes[current][key as keyof Palette],
});

/** Estilos que se recalculan (una vez) por cada modo. */
export function themedStyles<T extends object>(factory: () => T): T {
  const cache: Partial<Record<Mode, T>> = {};
  return new Proxy({} as T, {
    get: (_t, key) => {
      if (!cache[current]) cache[current] = factory();
      return (cache[current] as Record<string | symbol, unknown>)[key];
    },
  });
}

const KEY = "pinak.theme";

interface ThemeValue {
  mode: Mode;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeValue>({ mode: current, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(current);

  useEffect(() => {
    getItem(KEY).then((saved) => {
      if (saved === "dark" || saved === "light") {
        current = saved;
        setMode(saved);
      }
    });
  }, []);

  const toggle = useCallback(() => {
    const next: Mode = current === "dark" ? "light" : "dark";
    current = next;
    setMode(next);
    setItem(KEY, next);
  }, []);

  // `key` fuerza a redibujar todo el árbol con la paleta nueva.
  return createElement(ThemeContext.Provider, { value: { mode, toggle }, key: mode }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}
