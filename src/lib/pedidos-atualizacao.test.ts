import { describe, expect, test } from "bun:test";
import {
  contagemMudouSinais,
  devePausarAtualizacaoLista,
  houvePedidoNovo,
  mesclarPrimeiraPagina,
  sinaisDaContagem,
  TITULO_NOVO_PEDIDO,
  totalEmAndamento,
} from "./pedidos-atualizacao";

describe("pedidos-atualizacao", () => {
  test("chega pedido com a tela aberta: contagem sobe e lista deve invalidar", () => {
    const antes = { aguardando: 1, andamento: 2 };
    const agora = { aguardando: 2, andamento: 2 };
    expect(houvePedidoNovo(antes.aguardando, agora.aguardando)).toBe(true);
    expect(contagemMudouSinais(antes, agora)).toBe(true);
    expect(TITULO_NOVO_PEDIDO).toBe("(1) Novo pedido");
  });

  test("contador e lista ficam iguais: sinais vêm da mesma contagem", () => {
    const c = {
      aguardando_loja: { total: 3 },
      em_andamento: { confirmado: 1, em_preparo: 2 },
    };
    expect(sinaisDaContagem(c)).toEqual({ aguardando: 3, andamento: 3 });
    expect(totalEmAndamento(c.em_andamento)).toBe(3);
    expect(contagemMudouSinais({ aguardando: 3, andamento: 3 }, sinaisDaContagem(c))).toBe(false);
  });

  test("com diálogo aberto, a lista não pula", () => {
    expect(devePausarAtualizacaoLista({ dialogoStatus: true, ocupado: false })).toBe(true);
    expect(devePausarAtualizacaoLista({ dialogoStatus: false, ocupado: true })).toBe(true);
    expect(devePausarAtualizacaoLista({ dialogoStatus: false, ocupado: false })).toBe(false);
  });

  test("intervalo só troca a primeira página", () => {
    type P = { itens: string[]; proximo_cursor: number | null };
    const atual = {
      pages: [
        { itens: ["a"], proximo_cursor: 1 },
        { itens: ["b"], proximo_cursor: null },
      ] as P[],
      pageParams: [null, 1],
    };
    const nova: P = { itens: ["novo", "a"], proximo_cursor: 1 };
    expect(mesclarPrimeiraPagina(atual, nova)).toEqual({
      pages: [nova, { itens: ["b"], proximo_cursor: null }],
      pageParams: [null, 1],
    });
  });
});
