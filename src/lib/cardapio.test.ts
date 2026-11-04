import { describe, expect, test } from "bun:test";
import {
  ajustarRepeticao,
  alternarOpcao,
  chaveDaLinha,
  depoisDeOutroPedidoLoja,
  ENDERECO_VAZIO,
  faltaNoEndereco,
  faltaNasEscolhas,
  filtrarCategorias,
  mascaraCep,
  montarEndereco,
  mudarQuantidade,
  novaLinha,
  outroPedidoVoltaAoCardapio,
  precoUnitario,
  proximaAbertura,
  resumoDoPedido,
  respostaDePedidoEhRepetida,
  somarLinha,
  TEXTO_NOVO_LINK_CONVERSA,
  textoAbertura,
  textoLinkJaUsado,
  textoRecusa,
  unidadeLiberada,
  whatsappDaConversa,
  type Categoria,
  type Grupo,
  type ItemCardapio,
  pendenciaDaArea,
  taxaFinal,
  type CotacaoTaxa,
} from "./cardapio";

const ponto: Grupo = {
  grupo_id: 1,
  nome: "Ponto",
  obrigatorio: true,
  minimo: 1,
  maximo: 1,
  repetir: false,
  opcoes: [
    { opcao_id: 11, nome: "Mal passado", preco_extra: 0, disponivel: true },
    { opcao_id: 12, nome: "Bem passado", preco_extra: null, disponivel: true },
  ],
};
const extras: Grupo = {
  grupo_id: 2,
  nome: "Extras",
  obrigatorio: false,
  minimo: 0,
  maximo: 2,
  repetir: true,
  opcoes: [
    { opcao_id: 21, nome: "Bacon", preco_extra: 4.1, disponivel: true },
    { opcao_id: 22, nome: "Ovo", preco_extra: 2.2, disponivel: true },
  ],
};
const lanche: ItemCardapio = {
  item_id: 1,
  nome: "Lanche",
  descricao: "Pão e carne",
  preco: 19.9,
  alcoolico: false,
  disponivel: true,
  aviso: null,
  grupos: [ponto, extras],
};
const cerveja: ItemCardapio = {
  ...lanche,
  item_id: 2,
  nome: "Sapporo",
  descricao: null,
  preco: 0.1,
  alcoolico: true,
  grupos: [],
};
const esgotado: ItemCardapio = { ...lanche, item_id: 3, disponivel: false, grupos: [] };
const categorias: Categoria[] = [
  { nome: "Lanches", itens: [lanche, esgotado] },
  { nome: "Bebidas", itens: [cerveja] },
];

describe("linhas do pedido", () => {
  test("mesma escolha soma, em qualquer ordem; escolha ou observação diferente separa", () => {
    const a = [
      { grupo_id: 1, opcao_id: 11, quantidade: 1 },
      { grupo_id: 2, opcao_id: 21, quantidade: 1 },
    ];
    expect(chaveDaLinha(1, a, " sem sal ")).toBe(chaveDaLinha(1, [...a].reverse(), "sem sal"));
    let linhas = somarLinha([], novaLinha(1, 1, a, ""));
    linhas = somarLinha(linhas, novaLinha(1, 2, a, ""));
    expect(linhas.map((l) => l.quantidade)).toEqual([3]);
    linhas = somarLinha(linhas, novaLinha(1, 1, a, "sem sal"));
    expect(linhas).toHaveLength(2);
  });

  test("quantidade tem teto e zero tira a linha", () => {
    const linhas = [novaLinha(2, 98, [], "")];
    expect(somarLinha(linhas, novaLinha(2, 5, [], ""))[0]!.quantidade).toBe(99);
    expect(mudarQuantidade(linhas, linhas[0]!.chave, 0)).toEqual([]);
  });
});

describe("preço e total", () => {
  test("soma extras e trata extra sem valor como zero", () => {
    const escolhas = [
      { grupo_id: 1, opcao_id: 12, quantidade: 1 },
      { grupo_id: 2, opcao_id: 21, quantidade: 2 },
    ];
    expect(precoUnitario(lanche, escolhas)).toBeCloseTo(28.1);
  });

  test("total sem erro de ponto flutuante, com taxa; item indisponível fica de fora", () => {
    const linhas = [novaLinha(2, 3, [], ""), novaLinha(3, 1, [], ""), novaLinha(99, 1, [], "")];
    const r = resumoDoPedido(linhas, categorias, 5.5);
    expect(r.subtotal).toBe(0.3);
    expect(r.total).toBe(5.8);
    expect(r.alcoolico).toBe(true);
    expect(r.fora.map((l) => l.item_id)).toEqual([3, 99]);
    expect(r.quantidade).toBe(3);
  });
});

describe("escolhas", () => {
  test("obrigatório pendente trava; máximo não passa", () => {
    expect(faltaNasEscolhas(lanche, [])).toBe("Escolha: Ponto");
    const ok = [{ grupo_id: 1, opcao_id: 11, quantidade: 1 }];
    expect(faltaNasEscolhas(lanche, ok)).toBeNull();
    let e = alternarOpcao(extras, ok, 21);
    e = alternarOpcao(extras, e, 22);
    expect(alternarOpcao(extras, e, 21)).toHaveLength(2);
  });

  test("escolha única troca e, sendo obrigatória, não desmarca", () => {
    let e = alternarOpcao(ponto, [], 11);
    e = alternarOpcao(ponto, e, 12);
    expect(e.map((x) => x.opcao_id)).toEqual([12]);
    expect(alternarOpcao(ponto, e, 12).map((x) => x.opcao_id)).toEqual([12]);
  });

  test("repetição respeita o máximo do grupo", () => {
    let e = ajustarRepeticao(extras, [], 21, 1);
    e = ajustarRepeticao(extras, e, 21, 1);
    expect(ajustarRepeticao(extras, e, 22, 1)).toEqual(e);
    expect(ajustarRepeticao(extras, e, 21, -2)).toEqual([]);
  });
});

test("busca ignora acento e tira categorias vazias", () => {
  expect(filtrarCategorias(categorias, "PÃO").map((c) => c.nome)).toEqual(["Lanches"]);
  expect(filtrarCategorias(categorias, "sapporo").map((c) => c.nome)).toEqual(["Bebidas"]);
  expect(filtrarCategorias(categorias, "")).toHaveLength(2);
});

test("textos para o cliente", () => {
  // 01/11 às 23:30 em São Paulo: já é dia 2 em UTC, e "hoje" precisa seguir o fuso da unidade.
  const agora = Date.parse("2026-11-02T02:30:00Z");
  expect(textoAbertura("2026-11-05T18:00:00-03:00", agora)).toBe("05/11 às 18h");
  expect(textoAbertura("2026-11-01T23:45:00-03:00", agora)).toBe("hoje às 23h45");
  expect(textoAbertura("2026-11-02T11:00:00-03:00", agora)).toBe("amanhã às 11h");
  expect(textoAbertura(null)).toBeNull();
  expect(textoAbertura("sem data")).toBeNull();
  expect(textoRecusa("falta_endereco")).toBe("Informe o endereço de entrega.");
  expect(textoRecusa("qualquer_coisa")).toContain("Tente de novo");
});

describe("endereço", () => {
  const base = {
    ...ENDERECO_VAZIO,
    rua: "Av. Paulista",
    bairro: "Bela Vista",
    cidade: "São Paulo",
  };

  test("máscara do CEP aceita colar com pontuação e corta o excesso", () => {
    expect(mascaraCep("01310100")).toBe("01310-100");
    expect(mascaraCep("013")).toBe("013");
    expect(mascaraCep("01.310-100999")).toBe("01310-100");
  });

  test("número é obrigatório, a não ser que o cliente marque sem número", () => {
    expect(faltaNoEndereco(ENDERECO_VAZIO)).toBe("Informe a rua");
    expect(faltaNoEndereco(base)).toBe("Informe o número");
    expect(faltaNoEndereco({ ...base, semNumero: true })).toBeNull();
    expect(faltaNoEndereco({ ...base, numero: "100", bairro: " " })).toBe("Informe o bairro");
    expect(faltaNoEndereco({ ...base, numero: "100" })).toBeNull();
  });

  test("monta uma linha com o que foi preenchido", () => {
    expect(
      montarEndereco({
        ...base,
        cep: "01310100",
        numero: " 1000 ",
        complemento: "Apto 12",
        uf: "sp",
        referencia: "Portão azul",
      }),
    ).toBe(
      "Av. Paulista, 1000 - Apto 12 - Bela Vista - São Paulo/SP - CEP 01310-100. Referência: Portão azul",
    );
    expect(montarEndereco({ ...base, semNumero: true })).toBe(
      "Av. Paulista, s/n - Bela Vista - São Paulo",
    );
    expect(montarEndereco({ ...base, numero: "1", referencia: "x".repeat(600) }).length).toBe(500);
  });
});

test("unidade fechada trava; sem horário ou com pedido agendado, não", () => {
  expect(unidadeLiberada({ aberta_agora: false }, false)).toBe(false);
  expect(unidadeLiberada({ aberta_agora: true }, false)).toBe(true);
  expect(unidadeLiberada({ aberta_agora: null }, false)).toBe(true);
  expect(unidadeLiberada({ aberta_agora: false }, true)).toBe(true);
  expect(
    proximaAbertura([
      { proxima_abertura: null },
      { proxima_abertura: "2026-11-03T18:00:00-03:00" },
      { proxima_abertura: "2026-11-03T11:00:00-03:00" },
    ]),
  ).toBe("2026-11-03T11:00:00-03:00");
  expect(proximaAbertura([{ proxima_abertura: null }])).toBeNull();
});

describe("taxa da entrega na página", () => {
  const cot = (parte: Partial<CotacaoTaxa>): CotacaoTaxa => ({
    atende: true,
    motivo: null,
    taxa: 8,
    origem: "bairro",
    pedir: null,
    ...parte,
  });
  test("frete grátis no valor exato; sem taxa conhecida, nada a zerar", () => {
    expect(taxaFinal(8, 50, 50)).toBe(0);
    expect(taxaFinal(8, 50, 49.99)).toBe(8);
    expect(taxaFinal(8, null, 999)).toBe(8);
    expect(taxaFinal(null, 50, 999)).toBeNull();
  });
  test("o que impede a entrega", () => {
    expect(pendenciaDaArea(cot({}), false)).toBeNull();
    expect(pendenciaDaArea(null, false)).toContain("endereço");
    expect(pendenciaDaArea(cot({ atende: false, motivo: "fora_area" }), false)).toBe(
      "Não entregamos neste endereço",
    );
    expect(pendenciaDaArea(cot({ motivo: "bairro_nao_reconhecido", pedir: "cep" }), false)).toBe(
      "Informe o CEP",
    );
    const bairro = cot({ motivo: "bairro_nao_reconhecido", pedir: "confirmar_bairro" });
    expect(pendenciaDaArea(bairro, false)).toBe("Confirme o bairro");
    expect(pendenciaDaArea(bairro, true)).toBeNull();
  });
});

describe("fazer outro pedido", () => {
  test("link da loja: Fazer outro pedido continua voltando ao cardápio vazio", () => {
    expect(outroPedidoVoltaAoCardapio(true)).toBe(true);
    const varias = depoisDeOutroPedidoLoja([{ codigo: "a" }, { codigo: "b" }]);
    expect(varias).toEqual({ linhas: [], unidade: null, limparRascunho: true });
    const unica = depoisDeOutroPedidoLoja([{ codigo: "patio" }]);
    expect(unica).toEqual({ linhas: [], unidade: "patio", limparRascunho: true });
  });

  test("link da conversa: depois de enviar, mostra texto do novo link e não abre o cardápio", () => {
    expect(outroPedidoVoltaAoCardapio(false)).toBe(false);
    expect(TEXTO_NOVO_LINK_CONVERSA).toBe("Peça um novo link na conversa");
    expect(whatsappDaConversa("5511947281513")).toBe("https://wa.me/5511947281513");
    expect(whatsappDaConversa(null)).toBeNull();
    expect(whatsappDaConversa("123")).toBeNull();
  });

  test("resposta repetido: true não mostra tela de sucesso", () => {
    expect(respostaDePedidoEhRepetida({ numero: "42", repetido: true })).toBe(true);
    expect(respostaDePedidoEhRepetida({ numero: "42", total: 10 })).toBe(false);
    expect(respostaDePedidoEhRepetida(null)).toBe(false);
    expect(textoLinkJaUsado("42")).toBe(
      "Este link já foi usado no pedido nº 42. Peça um novo link na conversa para fazer outro pedido.",
    );
  });

  test("reabrir link usado: mesmo botão e mesma mensagem da conversa", () => {
    // A tela `inicio.usado` reutiliza o mesmo texto e o mesmo wa.me, quando houver número.
    expect(TEXTO_NOVO_LINK_CONVERSA).toBe("Peça um novo link na conversa");
    expect(whatsappDaConversa("+55 (11) 94728-1513")).toBe("https://wa.me/5511947281513");
  });
});
