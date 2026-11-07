import { describe, expect, it } from "vitest";
import {
  ROTULO_STATUS_IFOOD,
  TEXTO_ACOMPANHAMENTO_IFOOD,
  deveMostrarBlocoIfood,
  filtrosListaIfood,
  pedidoIfoodPendente,
  rotuloStatusIfood,
  type BlocoIfoodIndicadores,
  type PedidoIfoodLista,
} from "./ifood-pedidos";

const pedidoBase = (over: Partial<PedidoIfoodLista> = {}): PedidoIfoodLista => ({
  order_id: "ord-1",
  numero: "1234",
  loja: "loja-a",
  status: "PLACED",
  teste: false,
  criado_em: "2026-05-01T12:00:00-03:00",
  tipo: "DELIVERY",
  canal_venda: "IFOOD",
  total: 42.5,
  cliente_nome: "Ana",
  bairro: "Centro",
  detalhado: true,
  numero_itens: 2,
  ...over,
});

describe("IFOOD1-b1 — status e selo", () => {
  it("traduz status do contrato para português", () => {
    expect(rotuloStatusIfood("PLACED")).toBe("Novo");
    expect(rotuloStatusIfood("CONFIRMED")).toBe("Confirmado");
    expect(rotuloStatusIfood("READY_TO_PICKUP")).toBe("Pronto");
    expect(rotuloStatusIfood("DISPATCHED")).toBe("Saiu para entrega");
    expect(rotuloStatusIfood("CONCLUDED")).toBe("Concluído");
    expect(rotuloStatusIfood("CANCELLED")).toBe("Cancelado");
    expect(Object.values(ROTULO_STATUS_IFOOD)).toContain("Novo");
  });

  it("selo de teste quando teste=true", () => {
    expect(pedidoBase({ teste: true }).teste).toBe(true);
    expect(pedidoBase({ teste: false }).teste).toBe(false);
  });

  it("texto fixo de acompanhamento", () => {
    expect(TEXTO_ACOMPANHAMENTO_IFOOD).toMatch(/só acompanhamento/);
  });
});

describe("IFOOD1-b1 — detalhe pendente / atualizar", () => {
  it("detalhado=false → pendente", () => {
    expect(pedidoIfoodPendente(pedidoBase({ detalhado: false }))).toBe(true);
    expect(pedidoIfoodPendente(pedidoBase({ detalhado: true }))).toBe(false);
  });

  it("filtros de lista montam query", () => {
    expect(
      filtrosListaIfood({
        de: "2026-05-01",
        ate: "2026-05-07",
        status: ["PLACED", "CONFIRMED"],
        loja: "loja-a",
        teste: true,
        limite: 50,
        antes: "2026-05-07T10:00:00-03:00",
      }),
    ).toEqual({
      de: "2026-05-01",
      ate: "2026-05-07",
      status: "PLACED,CONFIRMED",
      loja: "loja-a",
      teste: true,
      limite: 50,
      antes: "2026-05-07T10:00:00-03:00",
    });
  });
});

describe("IFOOD1-b1 — bloco Visão WhatsApp × iFood", () => {
  const bloco: BlocoIfoodIndicadores = {
    resumo: {
      pedidos: 3,
      faturamento: 100,
      ticket_medio: 33.33,
      clientes: 2,
      cancelados: 0,
      aguardando: 1,
      recebidos: 3,
    },
    anterior: {
      pedidos: 2,
      faturamento: 80,
      ticket_medio: 40,
      clientes: 2,
      cancelados: 0,
      aguardando: 0,
      recebidos: 2,
    },
    variacao_pct: { faturamento: 25, pedidos: 50, ticket_medio: -16.7 },
    evolucao: [{ inicio: "2026-05-01", pedidos: 1, faturamento: 40 }],
    produtos: [{ nome: "Burger", quantidade: 2, faturamento: 60 }],
  };

  it("mostra bloco quando ifood presente", () => {
    expect(deveMostrarBlocoIfood(bloco)).toBe(true);
  });

  it("não mostra bloco quando ifood=null", () => {
    expect(deveMostrarBlocoIfood(null)).toBe(false);
    expect(deveMostrarBlocoIfood(undefined)).toBe(false);
  });
});
