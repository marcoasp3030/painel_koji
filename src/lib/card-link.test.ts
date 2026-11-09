import { describe, expect, it } from "vitest";
import {
  AJUDA_ENVIAR_LINK_CARDAPIO,
  CAMPO_ENVIAR_LINK_CARDAPIO,
  ROTULO_ENVIAR_LINK_CARDAPIO,
  enviarLinkLigado,
  podeVerEnviarLinkCardapio,
  valorEnviarLink,
} from "./card-link";
import { AJUDA_CAMPO, ROTULO_CAMPO } from "./gateway/atendimento";
import { campoDePedidos } from "./gateway/modulos";

describe("CARD-LINK — interruptor por papel", () => {
  it("aparece para gestor e plataforma; não aparece para supervisor", () => {
    expect(podeVerEnviarLinkCardapio("gestor")).toBe(true);
    expect(podeVerEnviarLinkCardapio("plataforma")).toBe(true);
    expect(podeVerEnviarLinkCardapio("supervisor")).toBe(false);
    expect(podeVerEnviarLinkCardapio("funcionario")).toBe(false);
    expect(podeVerEnviarLinkCardapio(null)).toBe(false);
  });
});

describe("CARD-LINK — liga/desliga", () => {
  it("padrão on; off desliga", () => {
    expect(enviarLinkLigado(undefined)).toBe(true);
    expect(enviarLinkLigado(null)).toBe(true);
    expect(enviarLinkLigado("on")).toBe(true);
    expect(enviarLinkLigado("off")).toBe(false);
    expect(valorEnviarLink(true)).toBe("on");
    expect(valorEnviarLink(false)).toBe("off");
  });

  it("rótulo e ajuda batem com o contrato e estão no atendimento", () => {
    expect(ROTULO_CAMPO[CAMPO_ENVIAR_LINK_CARDAPIO]).toBe(ROTULO_ENVIAR_LINK_CARDAPIO);
    expect(AJUDA_CAMPO[CAMPO_ENVIAR_LINK_CARDAPIO]).toBe(AJUDA_ENVIAR_LINK_CARDAPIO);
    expect(AJUDA_ENVIAR_LINK_CARDAPIO).toMatch(/Link da loja continua funcionando/);
  });

  it("campo entra no grupo de pedidos", () => {
    expect(campoDePedidos(CAMPO_ENVIAR_LINK_CARDAPIO)).toBe(true);
  });
});
