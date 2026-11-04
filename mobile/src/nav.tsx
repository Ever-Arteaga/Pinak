import { createContext, useContext } from "react";

export type Screen =
  | "dashboard"
  | "receivables"
  | "reports"
  | "upgrade"
  | "profile"
  | "team"
  | "businesses"
  | "diagnosis";

interface NavValue {
  screen: Screen;
  go: (screen: Screen) => void;
  openMenu: () => void;
  /** Pide abrir "Registrar movimiento" en el Inicio (lo usa el botón + de la barra inferior). */
  requestAdd: () => void;
  /** Cambia cada vez que se pide registrar; el Inicio reacciona a ese cambio. */
  addSignal: number;
}

export const NavContext = createContext<NavValue>({
  screen: "dashboard",
  go: () => {},
  openMenu: () => {},
  requestAdd: () => {},
  addSignal: 0,
});
export const useNav = () => useContext(NavContext);
