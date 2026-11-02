import { describe, expect, test } from "bun:test";
import {
  avisosDasCores,
  contraste,
  fundoEscuro,
  legivelSobre,
  misturar,
  PALETAS,
  temaDoCardapio,
  textoSobre,
  type AparenciaCardapio,
} from "./cardapio-tema";

const base: AparenciaCardapio = {
  nome_exibicao: null,
  slogan: null,
  cor_primaria: "#b3261e",
  cor_destaque: "#ffb300",
  cor_fundo: "#fff8f3",
  cantos: "suave",
  titulos: "classica",
  logo_url: null,
  banner_url: null,
  banner_foco: 50,
};
const vars = (a: AparenciaCardapio) =>
  temaDoCardapio(a).estilo as unknown as Record<string, string>;

describe("contraste", () => {
  test("calcula os extremos e mistura as cores", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contraste("#ffffff", "#ffffff")).toBe(1);
    expect(misturar("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  test("texto sobre a cor escolhe o mais legível", () => {
    expect(textoSobre("#2e2340")).toBe("#ffffff");
    expect(textoSobre("#ffeb3b")).toBe("#17131d");
  });

  test("cor clara demais escurece até dar leitura, e fundo escuro faz o contrário", () => {
    const amarelo = legivelSobre("#ffeb3b", "#ffffff");
    expect(contraste(amarelo, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const azul = legivelSobre("#101040", "#14131a");
    expect(contraste(azul, "#14131a")).toBeGreaterThanOrEqual(4.5);
    expect(legivelSobre("#2e2340", "#ffffff")).toBe("#2e2340");
  });
});

describe("tema", () => {
  test("qualquer paleta pronta fica legível", () => {
    for (const p of PALETAS) {
      const v = vars({ ...base, ...p });
      expect(contraste(v["--cd-sobre"]!, p.cor_primaria)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(v["--cd-marca"]!, v["--card"]!)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(v["--ink-900"]!, v["--card"]!)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(v["--ink-500"]!, v["--card"]!)).toBeGreaterThanOrEqual(3);
    }
  });

  test("a pior combinação continua legível", () => {
    const v = vars({
      ...base,
      cor_primaria: "#ffff00",
      cor_destaque: "#ffff00",
      cor_fundo: "#ffffff",
    });
    expect(contraste(v["--cd-sobre"]!, "#ffff00")).toBeGreaterThanOrEqual(4.5);
    expect(contraste(v["--cd-marca"]!, v["--card"]!)).toBeGreaterThanOrEqual(4.5);
  });

  test("fundo escuro vira tema escuro", () => {
    expect(fundoEscuro("#14131a")).toBe(true);
    const v = vars({ ...base, cor_fundo: "#14131a" });
    expect(v["colorScheme"]).toBe("dark");
    expect(v["--ink-900"]).toBe("#ffffff");
    expect(v["--card"]).not.toBe("#ffffff");
  });

  test("cantos e títulos mudam por variável e classe; sem aparência usa o padrão", () => {
    expect(vars({ ...base, cantos: "retos" })["--radius-2xl"]).toBe("0.375rem");
    expect(vars(base)["--radius-2xl"]).toBeUndefined();
    expect(temaDoCardapio({ ...base, titulos: "moderna" }).classe).toBe("cd-titulos-modernos");
    expect((temaDoCardapio(null).estilo as Record<string, string>)["--purple-800"]).toBe("#2e2340");
  });

  test("avisa quando duas cores se confundem", () => {
    expect(avisosDasCores(base)).toEqual([]);
    expect(
      avisosDasCores({ cor_primaria: "#ffffff", cor_destaque: "#fefefe", cor_fundo: "#ffffff" }),
    ).toEqual(["primaria_igual_fundo", "destaque_igual_primaria"]);
  });
});

test("preparo de imagem: formato, tamanho e proporção", async () => {
  const { dimensoes, problemaNaImagem } = await import("./imagem-cliente");
  expect(problemaNaImagem({ type: "image/svg+xml", size: 10 })).toContain("PNG");
  expect(problemaNaImagem({ type: "image/png", size: 11 * 1024 * 1024 })).toContain("10 MB");
  expect(problemaNaImagem({ type: "image/webp", size: 10 })).toBeNull();
  expect(dimensoes(3200, 1600, 1600, 900)).toEqual({ largura: 1600, altura: 800 });
  expect(dimensoes(400, 300, 1600, 900)).toEqual({ largura: 400, altura: 300 });
});
