import { describe, expect, it } from "vitest";
import { isDeleteConfirmed, isRecentLogin, RECENT_LOGIN_MS } from "./accountRules";

const now = Date.UTC(2026, 9, 16, 12, 0, 0);
const sec = (msAgo: number) => (now - msAgo) / 1000;

describe("isRecentLogin", () => {
  it("acepta un inicio de sesión de hace 1 minuto", () => {
    expect(isRecentLogin(sec(60_000), now)).toBe(true);
  });
  it("acepta justo en el límite", () => {
    expect(isRecentLogin(sec(RECENT_LOGIN_MS), now)).toBe(true);
  });
  it("rechaza uno más viejo que el límite", () => {
    expect(isRecentLogin(sec(RECENT_LOGIN_MS + 1000), now)).toBe(false);
  });
  it("rechaza valores que no son números", () => {
    expect(isRecentLogin(undefined, now)).toBe(false);
    expect(isRecentLogin("123", now)).toBe(false);
    expect(isRecentLogin(NaN, now)).toBe(false);
  });
  it("rechaza una fecha muy en el futuro", () => {
    expect(isRecentLogin(sec(-10 * 60_000), now)).toBe(false);
  });
});

describe("isDeleteConfirmed", () => {
  it("acepta la frase sin importar mayúsculas ni espacios", () => {
    expect(isDeleteConfirmed("ELIMINAR")).toBe(true);
    expect(isDeleteConfirmed("  eliminar ")).toBe(true);
  });
  it("rechaza cualquier otra cosa", () => {
    expect(isDeleteConfirmed("")).toBe(false);
    expect(isDeleteConfirmed("borrar")).toBe(false);
    expect(isDeleteConfirmed(undefined)).toBe(false);
  });
});
