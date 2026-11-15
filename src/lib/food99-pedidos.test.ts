import { describe, expect, test } from "bun:test";
import { filtrarMenu, TENANT_NAV, ADMIN_NAV } from "./nav";
import { mostrarMenuPedidosFood99 } from "./food99";
import { autorizar, AcessoNegado } from "./gateway/modulo.server";
import {
  TEXTO_CONFIRMACAO_FOOD99,
  antesProximaPaginaFood99,
  deveMostrarBlocoFood99,
  filtrosListaFood99,
  orderIdFood99ComoTexto,
  rotuloEntregaFood99,
  rotuloPagamentoFood99,
  rotuloStatusFood99,
  type BlocoFood99Indicadores,
  type ListaPedidosFood99,
} from "./food99-pedidos";
import { corCanalVendas, rotuloCanalVendas } from "./pedidos-visao-vendas";

const ID_64 = "5764607801871631353";

describe("99FOOD1-b — pedidos e Visão", () => {
  test("aba Pedidos 99Food no menu gestor/plataforma; some sem loja", () => {
    expect(filtrarMenu(TENANT_NAV, "gestor").some((i) => i.to === "/ia/pedidos-99food")).toBe(
      true,
    );
    expect(filtrarMenu(ADMIN_NAV, "plataforma").some((i) => i.to === "/ia/pedidos-99food")).toBe(
      true,
    );
    expect(
      filtrarMenu(TENANT_NAV, "supervisor").some((i) => i.to === "/ia/pedidos-99food"),
    ).toBe(false);
    expect(mostrarMenuPedidosFood99([])).toBe(false);
    expect(mostrarMenuPedidosFood99([{ id: "nn0123456789abcdef" }])).toBe(true);
  });

  test("order_id de 64 bits fica como texto intacto (nunca Number)", () => {
    expect(orderIdFood99ComoTexto(ID_64)).toBe(ID_64);
    expect(orderIdFood99ComoTexto(ID_64)).not.toBe(String(Number(ID_64)));
    expect(Number(ID_64) === Number(ID_64) && !Number.isSafeInteger(Number(ID_64))).toBe(true);
    expect(orderIdFood99ComoTexto(Number(ID_64))).toBeNull();
    expect(orderIdFood99ComoTexto(42)).toBe("42");
  });

  test("rótulos de status, entrega e pagamento", () => {
    expect(rotuloStatusFood99("novo")).toBe("Novo");
    expect(rotuloStatusFood99("confirmado")).toBe("Confirmado");
    expect(rotuloStatusFood99("pronto")).toBe("Pronto");
    expect(rotuloStatusFood99("concluido")).toBe("Concluído");
    expect(rotuloStatusFood99("cancelado")).toBe("Cancelado");
    expect(rotuloEntregaFood99("entrega_99")).toBe("Entrega 99");
    expect(rotuloEntregaFood99("entrega_loja")).toBe("Entrega da loja");
    expect(rotuloPagamentoFood99("online")).toBe("Pago online");
    expect(rotuloPagamentoFood99("dinheiro")).toBe("Dinheiro");
    expect(rotuloPagamentoFood99("cartao_na_entrega")).toBe("Cartão na entrega");
    expect(rotuloPagamentoFood99("carteira_99")).toBe("Carteira 99");
    expect(TEXTO_CONFIRMACAO_FOOD99).toMatch(/app da 99Food/);
  });

  test("paginação: antes = criado_em do último quando mais=true", () => {
    const lista: ListaPedidosFood99 = {
      mais: true,
      itens: [
        {
          order_id: "1",
          numero: "1",
          loja: "nn1",
          unidade: "a",
          status: "novo",
          teste: false,
          criado_em: "2026-11-15T12:00:00-03:00",
          tipo_entrega: "entrega_99",
          total: 10,
          pagamento: "online",
          detalhado: true,
          numero_itens: 1,
        },
        {
          order_id: ID_64,
          numero: "2",
          loja: "nn1",
          unidade: "a",
          status: "novo",
          teste: true,
          criado_em: "2026-11-15T11:00:00-03:00",
          tipo_entrega: null,
          total: null,
          pagamento: null,
          detalhado: false,
          numero_itens: 0,
        },
      ],
    };
    expect(antesProximaPaginaFood99(lista)).toBe("2026-11-15T11:00:00-03:00");
    expect(antesProximaPaginaFood99({ ...lista, mais: false })).toBeUndefined();
    expect(
      filtrosListaFood99({
        status: "novo",
        unidade: "morumbi",
        teste: true,
        limite: 40,
        antes: "2026-11-15T11:00:00-03:00",
      }),
    ).toEqual({
      status: "novo",
      unidade: "morumbi",
      teste: true,
      limite: 40,
      antes: "2026-11-15T11:00:00-03:00",
    });
  });

  test("bloco Visão some quando 99food é nulo; canal tem cor própria", () => {
    expect(deveMostrarBlocoFood99(null)).toBe(false);
    expect(deveMostrarBlocoFood99(undefined)).toBe(false);
    const bloco: BlocoFood99Indicadores = {
      resumo: {
        pedidos: 1,
        faturamento: 10,
        ticket_medio: 10,
        cancelados: 0,
        aguardando: 0,
        recebidos: 1,
      },
      anterior: {
        pedidos: 0,
        faturamento: 0,
        ticket_medio: 0,
        cancelados: 0,
        aguardando: 0,
        recebidos: 0,
      },
      variacao_pct: { faturamento: null, pedidos: null, ticket_medio: null },
      evolucao: [],
      produtos: [],
    };
    expect(deveMostrarBlocoFood99(bloco)).toBe(true);
    expect(corCanalVendas("99food")).toBe("#FF6600");
    expect(corCanalVendas("ifood")).not.toBe(corCanalVendas("99food"));
    expect(rotuloCanalVendas("99food")).toBe("99Food");
  });

  test("autorizar: gestor lê pedidos e atualiza; supervisor não", () => {
    autorizar("gestor", "GET", ["99food", "pedidos"]);
    autorizar("gestor", "GET", ["99food", "pedidos", ID_64]);
    autorizar("gestor", "POST", ["99food", "pedidos", "atualizar"]);
    expect(() => autorizar("supervisor", "GET", ["99food", "pedidos"])).toThrow(AcessoNegado);
    expect(() => autorizar("funcionario", "GET", ["99food", "pedidos", ID_64])).toThrow(
      AcessoNegado,
    );
  });
});
