import { describe, expect, it } from "vitest";
import {
  CARTOES_RESUMO,
  algumaColetando,
  filtrosFinanceiroIfood,
  mensagemErroColeta,
  rotuloStatusRepasse,
  rotuloTipoRepasse,
  temFinanceiroPedido,
  type ColetaFinanceiroIfood,
  type FinanceiroIfood,
  type LinhaFinanceiroPedido,
} from "./ifood-financeiro";

const financeiroBase = (over: Partial<FinanceiroIfood> = {}): FinanceiroIfood => ({
  periodo: { de: "2026-10-08", ate: "2026-11-07" },
  resumo: {
    creditos: 150,
    debitos: -18,
    repasse_liquido: 82,
    recebido_direto: 50,
    pedidos: 2,
    eventos: 4,
  },
  por_tipo: [
    { nome: "SALE_CONCLUDED", descricao: "Venda", eventos: 2, valor: 150, com_repasse: true },
  ],
  por_dia: [{ data: "2026-11-06", creditos: 100, debitos: -12, repasse: 88 }],
  por_forma: [{ forma: "CREDIT", bandeira: "VISA", valor: 100, eventos: 1 }],
  a_receber: {
    total: 82,
    por_data: [{ data: "2026-11-10", valor: 82 }],
  },
  repasses: {
    pago: 500,
    pendente: 80,
    retido_recebiveis: 120,
    boletos: 0,
    renegociado: 0,
    itens: [
      {
        titulo: "t-1",
        loja: "loja-a",
        tipo: "REPASSE",
        produto: "IFOOD",
        valor: 500,
        status: "SUCCEED",
        pagamento_em: "2026-11-05",
        periodo_inicio: "2026-10-01",
        periodo_fim: "2026-10-07",
      },
    ],
  },
  coletas: [
    {
      loja: "loja-a",
      nome: "Loja A",
      sucesso_em: "2026-11-07T10:00:00-03:00",
      erro: null,
      coletando: false,
      coletado_desde: "2026-08-09",
    },
  ],
  ...over,
});

describe("IFOOD1-b2 — cartões e a receber", () => {
  it("cartões do resumo batem com o contrato", () => {
    const r = financeiroBase().resumo;
    expect(CARTOES_RESUMO.map((c) => c.chave)).toEqual([
      "creditos",
      "debitos",
      "repasse_liquido",
      "recebido_direto",
    ]);
    expect(r.creditos).toBe(150);
    expect(r.debitos).toBe(-18);
    expect(r.repasse_liquido).toBe(82);
    expect(r.recebido_direto).toBe(50);
  });

  it("a receber traz total e lista por data", () => {
    const a = financeiroBase().a_receber;
    expect(a.total).toBe(82);
    expect(a.por_data).toEqual([{ data: "2026-11-10", valor: 82 }]);
  });
});

describe("IFOOD1-b2 — repasses", () => {
  it("rótulos de tipo e status em português", () => {
    expect(rotuloTipoRepasse("REPASSE")).toBe("Repasse");
    expect(rotuloTipoRepasse("REGISTRO_RECEBIVEIS")).toBe("Retido (recebíveis)");
    expect(rotuloTipoRepasse("BOLETO")).toBe("Boleto");
    expect(rotuloTipoRepasse("RENEGOCIADA")).toBe("Renegociado");
    expect(rotuloStatusRepasse("SUCCEED")).toBe("Pago");
    expect(rotuloStatusRepasse("PENDING")).toBe("Pendente");
    expect(rotuloStatusRepasse("FAILED")).toBe("Falhou");
  });

  it("totais pago / pendente / retido / boletos", () => {
    const r = financeiroBase().repasses;
    expect(r.pago).toBe(500);
    expect(r.pendente).toBe(80);
    expect(r.retido_recebiveis).toBe(120);
    expect(r.boletos).toBe(0);
  });
});

describe("IFOOD1-b2 — coleta em andamento / erro", () => {
  it("detecta coleta em andamento", () => {
    const c: ColetaFinanceiroIfood[] = [
      {
        loja: "a",
        nome: "A",
        sucesso_em: null,
        erro: null,
        coletando: true,
        coletado_desde: null,
      },
    ];
    expect(algumaColetando(c)).toBe(true);
    expect(algumaColetando(financeiroBase().coletas)).toBe(false);
  });

  it("mensagem de erro de coleta", () => {
    expect(mensagemErroColeta("sem_permissao")).toBe(
      "A loja não deu acesso ao financeiro para o aplicativo",
    );
    expect(mensagemErroColeta("indisponivel")).toBe("iFood indisponível");
    expect(mensagemErroColeta("limite")).toBe("iFood indisponível");
    expect(mensagemErroColeta(null)).toBeNull();
  });

  it("filtros de período e loja", () => {
    expect(filtrosFinanceiroIfood({ de: "2026-10-01", ate: "2026-10-31", loja: "loja-a" })).toEqual({
      de: "2026-10-01",
      ate: "2026-10-31",
      loja: "loja-a",
    });
  });
});

describe("IFOOD1-b2 — detalhe com financeiro", () => {
  it("mostra bloco quando há linhas", () => {
    const linhas: LinhaFinanceiroPedido[] = [
      {
        nome: "SALE_CONCLUDED",
        descricao: "Venda",
        valor: 100,
        com_repasse: true,
        taxa_pct: null,
        pagamento_previsto: "2026-11-10",
      },
      {
        nome: "ORDER_COMMISSION",
        descricao: "Comissão",
        valor: -12,
        com_repasse: true,
        taxa_pct: 12,
        pagamento_previsto: "2026-11-10",
      },
    ];
    expect(temFinanceiroPedido(linhas)).toBe(true);
    expect(temFinanceiroPedido([])).toBe(false);
    expect(temFinanceiroPedido(undefined)).toBe(false);
  });
});
