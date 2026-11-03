import { describe, expect, test } from "bun:test";
import {
  ariaDaRede,
  instagramDasRedes,
  itensParaSalvarRedes,
  linhasFixasDasRedes,
  mensagemErroRede,
  redesAtivasParaExibir,
  tipoDaLinhaErro,
} from "./cardapio-redes";

describe("cardapio-redes", () => {
  test("linhas fixas na ordem da tela, com vazio quando não cadastrado", () => {
    expect(linhasFixasDasRedes([{ tipo: "telefone", valor: "5511999", ativo: false }])).toEqual([
      { tipo: "instagram", valor: "", ativo: true, url: undefined },
      { tipo: "facebook", valor: "", ativo: true, url: undefined },
      { tipo: "telefone", valor: "5511999", ativo: false, url: undefined },
    ]);
  });

  test("campo vazio não entra no PUT; ordem da tela se mantém", () => {
    expect(
      itensParaSalvarRedes([
        { tipo: "instagram", valor: "  @casa  ", ativo: true },
        { tipo: "facebook", valor: "   ", ativo: true },
        { tipo: "telefone", valor: "11 91234-5678", ativo: false },
      ]),
    ).toEqual([
      { tipo: "instagram", valor: "@casa", ativo: true },
      { tipo: "telefone", valor: "11 91234-5678", ativo: false },
    ]);
  });

  test("só ativas com valor aparecem; Instagram tem aria e CTA", () => {
    const redes = redesAtivasParaExibir([
      { tipo: "instagram", valor: "@casa.sushi", ativo: true },
      { tipo: "facebook", valor: "casa", ativo: false },
      { tipo: "telefone", valor: "(11) 91234-5678", ativo: true },
    ]);
    expect(redes.map((r) => r.tipo)).toEqual(["instagram", "telefone"]);
    expect(instagramDasRedes(redes)?.url).toBe("https://instagram.com/casa.sushi");
    expect(ariaDaRede("instagram", "By Koji")).toBe("Instagram do By Koji");
    expect(instagramDasRedes([])).toBeNull();
  });

  test("erro 400: telefone usa mensagem; linha aponta o tipo enviado", () => {
    expect(mensagemErroRede("telefone", "Use DDD + número, ex.: 11912345678")).toBe(
      "Use DDD + número, ex.: 11912345678",
    );
    expect(mensagemErroRede("endereco_invalido", null)).toMatch(/link oficial/);
    const enviados = itensParaSalvarRedes([
      { tipo: "instagram", valor: "@a", ativo: true },
      { tipo: "facebook", valor: "", ativo: true },
      { tipo: "telefone", valor: "11", ativo: true },
    ]);
    expect(tipoDaLinhaErro(enviados, 2)).toBe("telefone");
    expect(tipoDaLinhaErro(enviados, 9)).toBeNull();
  });
});
