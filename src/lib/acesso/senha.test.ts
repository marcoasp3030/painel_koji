import { describe, expect, test } from "bun:test";
import { forcaSenha, senhaComum, validarSenhaNova } from "./senha";

describe("senha", () => {
  test("rejeita comuns e curtas", () => {
    expect(senhaComum("senha123")).toBe(true);
    expect(validarSenhaNova("curta")).toMatch(/12/);
    expect(validarSenhaNova("administrador")).toMatch(/comum/);
    expect(validarSenhaNova("Tr0c4Segura!9x", "outra")).toMatch(/conferem/);
    expect(validarSenhaNova("Tr0c4Segura!9x", "Tr0c4Segura!9x")).toBeNull();
  });

  test("medidor sobe com complexidade", () => {
    expect(forcaSenha("abc").nota).toBeLessThanOrEqual(1);
    expect(forcaSenha("Tr0c4Segura!9xMaisLonga").nota).toBeGreaterThanOrEqual(3);
  });
});
