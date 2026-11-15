import { describe, expect, test } from "bun:test";
import {
  AJUDA_ENVIAR_LINK_CARDAPIO,
  CAMPO_ENVIAR_LINK_CARDAPIO,
  CAMPO_LINK_CARDAPIO_PROPRIO,
  ERRO_LINK_CARDAPIO,
  MODOS_ENVIAR_LINK_CARDAPIO,
  ROTULO_ENVIAR_LINK_CARDAPIO,
  ROTULO_MODO_LINK_CARDAPIO,
  linkCardapioValido,
  mensagemErroLinkCardapio,
  modoEnviarLinkCardapio,
  normalizarLinkCardapio,
  podeVerEnviarLinkCardapio,
  rotuloModoLinkCardapio,
} from "./card-link";
import { AJUDA_CAMPO, ROTULO_CAMPO, ROTULO_OPCAO } from "./gateway/atendimento";
import { campoDePedidos } from "./gateway/modulos";

describe("CARD-LINK2 — interruptor por papel", () => {
  test("aparece para gestor e plataforma; não aparece para supervisor", () => {
    expect(podeVerEnviarLinkCardapio("gestor")).toBe(true);
    expect(podeVerEnviarLinkCardapio("plataforma")).toBe(true);
    expect(podeVerEnviarLinkCardapio("supervisor")).toBe(false);
    expect(podeVerEnviarLinkCardapio("funcionario")).toBe(false);
    expect(podeVerEnviarLinkCardapio(null)).toBe(false);
  });
});

describe("CARD-LINK2 — três opções", () => {
  test("on / proprio / off com rótulos do contrato", () => {
    expect(MODOS_ENVIAR_LINK_CARDAPIO).toEqual(["on", "proprio", "off"]);
    expect(modoEnviarLinkCardapio(undefined)).toBe("on");
    expect(modoEnviarLinkCardapio(null)).toBe("on");
    expect(modoEnviarLinkCardapio("on")).toBe("on");
    expect(modoEnviarLinkCardapio("proprio")).toBe("proprio");
    expect(modoEnviarLinkCardapio("off")).toBe("off");
    expect(ROTULO_MODO_LINK_CARDAPIO.on).toBe("Cardápio do sistema");
    expect(ROTULO_MODO_LINK_CARDAPIO.proprio).toBe("Link próprio");
    expect(ROTULO_MODO_LINK_CARDAPIO.off).toBe("Não enviar link");
    expect(rotuloModoLinkCardapio("proprio")).toBe("Link próprio");
    expect(ROTULO_OPCAO.proprio).toBe("Link próprio");
  });

  test("rótulo e ajuda batem com o contrato e estão no atendimento", () => {
    expect(ROTULO_CAMPO[CAMPO_ENVIAR_LINK_CARDAPIO]).toBe(ROTULO_ENVIAR_LINK_CARDAPIO);
    expect(AJUDA_CAMPO[CAMPO_ENVIAR_LINK_CARDAPIO]).toBe(AJUDA_ENVIAR_LINK_CARDAPIO);
    expect(AJUDA_ENVIAR_LINK_CARDAPIO).toMatch(/unidade/);
    expect(ROTULO_CAMPO[CAMPO_LINK_CARDAPIO_PROPRIO]).toMatch(/Link do cardápio/);
  });

  test("campos entram no grupo de pedidos", () => {
    expect(campoDePedidos(CAMPO_ENVIAR_LINK_CARDAPIO)).toBe(true);
    expect(campoDePedidos(CAMPO_LINK_CARDAPIO_PROPRIO)).toBe(true);
  });
});

describe("CARD-LINK2 — link https", () => {
  test("link inválido recusado; válido e vazio ok", () => {
    expect(linkCardapioValido(null)).toBe(true);
    expect(linkCardapioValido("")).toBe(true);
    expect(linkCardapioValido("https://cardapio.exemplo.test/bykoji")).toBe(true);
    expect(linkCardapioValido("http://cardapio.exemplo.test/x")).toBe(false);
    expect(linkCardapioValido("https://site.test/a b")).toBe(false);
    expect(mensagemErroLinkCardapio("http://x.test")).toBe(ERRO_LINK_CARDAPIO);
    expect(mensagemErroLinkCardapio("https://ok.test/menu")).toBeNull();
  });

  test("campo da unidade: salva string e limpa com null", () => {
    expect(normalizarLinkCardapio("  https://a.test/x  ")).toBe("https://a.test/x");
    expect(normalizarLinkCardapio("")).toBeNull();
    expect(normalizarLinkCardapio("   ")).toBeNull();
    expect(normalizarLinkCardapio(null)).toBeNull();
  });
});
