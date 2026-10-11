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
}

export const NavContext = createContext<NavValue>({ screen: "dashboard", go: () => {}, openMenu: () => {} });
export const useNav = () => useContext(NavContext);
