import { describe, expect, test } from "bun:test";
import type { PedidoDetalhe } from "@/lib/gateway/pedidos";
import { htmlDoCupom, linhasDasOpcoes, paraImprimir } from "./impressao-pedido";

const base: PedidoDetalhe = {
  id: 1,
  numero: "18380",
  status: "aguardando_loja",
  modalidade: "delivery",
  unidade: "centro",
  unidade_nome: "Centro",
  origem: "real",
  cliente: { nome: "Ana", telefone: "5511900000001", canal: null },
  conversation_id: null,
  numero_itens: 1,
  total: 68,
  previsao_min: null,
  criado_em: "2026-11-03T22:15:00Z",
  atualizado_em: null,
  horario: null,
  aviso: null,
  pagamento: { forma: "pix", rotulo: "Pix", troco_para: null, troco: null },
  itens: [
    {
      codigo: "T1",
      nome: "Temaki <salmão>",
      quantidade: 2,
      preco_unitario: 30,
      subtotal: 60,
      observacao: "sem cebolinha",
      alcoolico: false,
      opcoes: [
        { grupo: "Tamanho", opcao: "Grande", quantidade: 1 },
        { grupo: "Adicionais", opcao: "Cream cheese", quantidade: 2 },
      ],
    },
  ],
  subtotal: 60,
  taxa_entrega: 8,
  taxa_origem: "bairro",
  observacao: null,
  endereco: "Rua A, 1 - Vila Mariana",
  motivo: null,
  status_descricao: null,
  entrega: null,
  proximos_status: [],
  linha_do_tempo: [],
};
const cupom = (p: Partial<PedidoDetalhe>, largura: 58 | 80 = 80) =>
  htmlDoCupom({ ...base, ...p }, { largura, fuso: "America/Sao_Paulo", empresa: "Loja" });

describe("cupom de cozinha", () => {
  test("entrega com itens, opções, observação, endereço, taxa e hora no fuso da loja", () => {
    const h = cupom({});
    expect(h).toContain("#18380");
    expect(h).toContain("ENTREGA");
    expect(h).toContain("Temaki &lt;salmão&gt;");
    expect(h).not.toContain("<salmão>");
    expect(h).toContain("+ Tamanho: Grande");
    expect(h).toContain("+ Adicionais: 2× Cream cheese");
    expect(h).toContain("Obs: sem cebolinha");
    expect(h).toContain("Rua A, 1 - Vila Mariana");
    expect(h).toMatch(/Entrega<\/span><span>R\$\s8,00/);
    expect(h).toContain("<b>Ana</b> · +55 11 90000-0001");
    expect(h).toContain("03/11, 19:15");
    expect(h).toContain("size:80mm auto");
  });

  test("retirada não leva endereço nem telefone; taxa a confirmar e origem de teste aparecem", () => {
    const h = cupom({ modalidade: "retirada" });
    expect(h).toContain("RETIRADA");
    expect(h).not.toContain("Vila Mariana");
    expect(h).not.toContain("90000-0001");
    expect(cupom({ taxa_origem: "a_confirmar", taxa_entrega: null })).toContain("A confirmar");
    expect(cupom({ frete_gratis: true, taxa_entrega: 0 })).toContain("Grátis");
    expect(cupom({ origem: "teste" })).toContain("TESTE");
    expect(cupom({}, 58)).toContain("size:58mm auto");
  });

  test("opções sem nome somem e quantidade 1 não aparece", () => {
    expect(
      linhasDasOpcoes([
        { grupo: "Molho", opcao: "Tarê", quantidade: 1 },
        { grupo: "X", opcao: null },
      ]),
    ).toEqual(["Molho: Tarê"]);
    expect(linhasDasOpcoes(undefined)).toEqual([]);
  });

  test("só os não impressos, do mais antigo para o mais novo", () => {
    const lista = [{ numero: "3" }, { numero: "2" }, { numero: "1" }];
    expect(paraImprimir(lista, ["1"])).toEqual(["2", "3"]);
    expect(paraImprimir(lista, ["1", "2", "3"])).toEqual([]);
  });
});
