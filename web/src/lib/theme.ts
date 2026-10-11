"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "pinak.theme";

function systemTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0c0e1f" : "#10123a");
}

/** Tema actual (guardado o, si no hay, el del sistema) y una función para alternarlo. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const set = useCallback((next: Theme) => {
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* sin almacenamiento: solo dura esta sesión */
    }
  }, []);

  const toggle = useCallback(() => set(theme === "dark" ? "light" : "dark"), [set, theme]);
  return { theme, toggle };
}

/** Script que corre antes de pintar para evitar el parpadeo del tema. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export { systemTheme };
