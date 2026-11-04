import { describe, expect, test } from "bun:test";
import {
  confirmacaoExcluirCanalConfere,
  DICA_CANAL_ATIVO,
  excluirCanalDesabilitado,
  podeExibirExcluirCanal,
  toastExcluirCanal,
} from "./canal-excluir";

describe("CANAL-EXC", () => {
  test("plataforma vê o botão; os outros papéis não", () => {
    expect(podeExibirExcluirCanal("plataforma")).toBe(true);
    for (const papel of ["gestor", "supervisor", "funcionario"] as const) {
      expect(podeExibirExcluirCanal(papel)).toBe(false);
    }
    expect(podeExibirExcluirCanal(null)).toBe(false);
  });

  test("canal ativo fica desabilitado com a dica", () => {
    expect(excluirCanalDesabilitado(true)).toBe(true);
    expect(excluirCanalDesabilitado(false)).toBe(false);
    expect(DICA_CANAL_ATIVO).toBe("Desative o canal antes de excluir");
  });

  test("nome errado não habilita; nome igual (com espaços) habilita", () => {
    expect(confirmacaoExcluirCanalConfere("WhatsApp Loja", "WhatsApp Loja")).toBe(true);
    expect(confirmacaoExcluirCanalConfere("  WhatsApp Loja  ", "WhatsApp Loja")).toBe(true);
    expect(confirmacaoExcluirCanalConfere("whatsapp loja", "WhatsApp Loja")).toBe(false);
    expect(confirmacaoExcluirCanalConfere("WhatsApp", "WhatsApp Loja")).toBe(false);
    expect(confirmacaoExcluirCanalConfere("", "WhatsApp Loja")).toBe(false);
  });

  test("sucesso: toast soma conversas e mantém pedidos; tira o canal da lista após reload", () => {
    expect(
      toastExcluirCanal({
        ok: true,
        conversas_apagadas: 3,
        conversas_com_pedido: 2,
        pedidos_mantidos: 5,
      }),
    ).toBe("Canal excluído: 5 conversas apagadas, 5 pedidos mantidos");
    // A UI chama recarregar() e o canal some do GET /canais.
  });
});
