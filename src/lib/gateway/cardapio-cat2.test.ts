import { expect, test } from "bun:test";
import { criarClienteGateway } from "./cliente.server";
import { criarModuloGateway, type PapelGateway } from "./modulo.server";
import { executarCardapio } from "./cardapio.server";
import type { ItemCardapio } from "./cardapio";
import {
  AVISO_SEM_PRECO,
  avisoCategoriaSome,
  camposAlterados,
  categoriaVaiSumir,
  dadosDe,
  dataHistorico,
  diferencaItem,
  horaReferencia,
  lerPreco,
  motivoItem,
  opcoesCategoria,
  precoDigitado,
  precoEditavel,
  situacaoAgora,
} from "./cardapio-cat2";

/** Item no formato da ESPEC_CAT2 §1, com microssegundos no atualizado_em. */
const ITEM = {
  item_id: 666,
  codigo: "GUE-0001",
  unidade: "patio_guedala",
  categoria: "Entradas quentes",
  nome: "Edamame",
  descricao: null,
  preco: 34.0,
  alcoolico: false,
  delivery: "a_confirmar",
  tipo: "item",
  observacao: "obs interna",
  ativo: true,
  atualizado_em: "2026-10-13T01:05:26.123456Z",
  disponibilidade: null,
  disponivel_agora: true,
  indisponivel_motivo: null,
  data_referencia: "2026-10-12T22:05-03:00",
};
const LIDO = ITEM as unknown as ItemCardapio;

async function montar(papel: PapelGateway = "gestor", respostas: Response[] = []) {
  const chamadas: { url: URL; role: string | null; method?: string; body: unknown }[] = [];
  const modulo = criarModuloGateway({
    carregarPerfil: async () => ({
      userId: "u",
      email: "ana@teste.com",
      superAdmin: papel === "plataforma",
      vinculos: [
        {
          gatewayTenantId: "teste",
          ativo: true,
          admin: papel === "gestor",
          ...(papel === "plataforma" ? {} : { papel, unidades: papel === "gestor" ? ("*" as const) : ["centro"] }),
        },
      ],
    }),
    cliente: criarClienteGateway({
      url: "http://gateway/admin/v1",
      chave: "chave-sintetica-testes",
      chavePlataforma: "chave-sintetica-testes",
      fetch: (async (url: URL, init: RequestInit) => {
        chamadas.push({
          url: new URL(String(url)),
          role: new Headers(init.headers).get("X-Role"),
          method: init.method,
          body: init.body ? JSON.parse(String(init.body)) : null,
        });
        return respostas.shift() ?? Response.json(ITEM);
      }) as typeof fetch,
    }),
  });
  return { sessao: await modulo.sessao({ userId: "u", email: "forjado@teste.com" }), chamadas };
}

test("CAT2 preço: aceita 36,50, mostra em R$, vazio é sem preço, recusa 3 casas e zero", () => {
  expect(lerPreco("36,50")).toBe(36.5);
  expect(lerPreco("36.5")).toBe(36.5);
  expect(lerPreco("R$ 124")).toBe(124);
  expect(lerPreco("  ")).toBeNull();
  for (const v of ["36,555", "0", "0,00", "100000", "1.234,50", "-3", "abc"])
    expect(() => lerPreco(v)).toThrow();
  expect(precoEditavel(36.5)).toBe("36,50");
  expect(precoEditavel(null)).toBe("");
  expect(precoDigitado("36,5").texto.replace(/\s/g, " ")).toBe("R$ 36,50");
  expect(precoDigitado("").texto).toBe("Sem preço");
  expect(precoDigitado("1,999").erro).toBe(true);
});

test("CAT2 diferença: só os campos que mudaram; descrição com espaços apaga", () => {
  expect(diferencaItem(LIDO, dadosDe(LIDO))).toEqual({});
  expect(diferencaItem(LIDO, { ...dadosDe(LIDO), preco: "36,50" })).toEqual({ preco: 36.5 });
  expect(diferencaItem(LIDO, { ...dadosDe(LIDO), preco: "34,00" })).toEqual({});
  expect(
    diferencaItem(LIDO, {
      ...dadosDe(LIDO),
      nome: "  Edamame no vapor ",
      descricao: "Vagens de soja",
      categoria: "Entradas frias",
      ativo: false,
      preco: "",
    }),
  ).toEqual({
    nome: "Edamame no vapor",
    descricao: "Vagens de soja",
    categoria: "Entradas frias",
    ativo: false,
    preco: null,
  });
  const comDescricao = { ...LIDO, descricao: "Vagens" };
  expect(diferencaItem(comDescricao, { ...dadosDe(comDescricao), descricao: "   " })).toEqual({
    descricao: null,
  });
});

test("CAT2 avisos: sem preço e categoria que some ao mover o último item", () => {
  expect(AVISO_SEM_PRECO).toBe("Sem preço, o item sai do cardápio do atendimento.");
  const cats = [
    { categoria: "Entradas frias", ordem: 2, qtd_itens: 4 },
    { categoria: "Entradas quentes", ordem: 1, qtd_itens: 1 },
  ];
  expect(categoriaVaiSumir(cats, LIDO, { categoria: "Entradas frias" })).toBe("Entradas quentes");
  expect(avisoCategoriaSome("Entradas quentes")).toBe(
    "A categoria Entradas quentes vai deixar de existir.",
  );
  expect(categoriaVaiSumir(cats, LIDO, { preco: 10 })).toBeNull();
  expect(
    categoriaVaiSumir(
      cats.map((c) => ({ ...c, qtd_itens: 3 })),
      LIDO,
      { categoria: "Entradas frias" },
    ),
  ).toBeNull();
  expect(opcoesCategoria(cats, "Entradas quentes")).toEqual(["Entradas quentes", "Entradas frias"]);
  expect(opcoesCategoria(cats, "Antiga")).toEqual(["Antiga", "Entradas quentes", "Entradas frias"]);
});

test("CAT2 agora em palavras: os seis motivos e a hora de referência da unidade", () => {
  expect(
    ["item_inativo", "sem_preco", "sem_delivery", "dia_da_semana", "feriado", "horario"].map(
      motivoItem,
    ),
  ).toEqual(["inativo", "sem preço", "sem delivery", "fora do dia", "feriado", "fora do horário"]);
  expect(situacaoAgora({ disponivel_agora: true })).toBe("Agora: disponível");
  expect(situacaoAgora({ disponivel_agora: false, indisponivel_motivo: "horario" })).toBe(
    "Agora: indisponível · fora do horário",
  );
  expect(situacaoAgora({})).toBe("Agora: sem informação");
  expect(horaReferencia("2026-10-12T22:05-03:00")).toBe("12/10 às 22:05");
  expect(horaReferencia(undefined)).toBe("");
});

test("CAT2 histórico em palavras e no horário de Brasília", () => {
  const linhas = camposAlterados({
    id: 1,
    actor: "ana",
    criado_em: "2026-10-13T01:05:26.123456Z",
    antes: { descricao: null, preco: 34.0, ativo: true, disponibilidade: null },
    depois: {
      descricao: "Vagens de soja no vapor",
      preco: 36.5,
      ativo: false,
      disponibilidade: { resumo: "segunda a sexta" },
    },
  });
  const espaco = (s: string) => s.replace(/\s/g, " ");
  expect(linhas.map((l) => [l.nome, espaco(l.antes), espaco(l.depois)])).toEqual([
    ["Descrição", "(vazio)", "Vagens de soja no vapor"],
    ["Preço", "R$ 34,00", "R$ 36,50"],
    ["Ativo", "Sim", "Não"],
    ["Disponibilidade", "Sempre disponível", "segunda a sexta"],
  ]);
  const data = dataHistorico("2026-10-13T01:05:26.123456Z");
  expect(data).toContain("12/10/2026");
  expect(data).toContain("22:05");
});

test("CAT2 PATCH: admin e plataforma mandam só o que mudou e o atualizado_em como foi lido", async () => {
  for (const papel of ["gestor", "plataforma"] as const) {
    const c = await montar(papel, [Response.json({ ...ITEM, preco: 36.5 })]);
    const r = await executarCardapio(c.sessao, {
      empresa: "teste",
      acao: "editar",
      item_id: 666,
      atualizado_em: ITEM.atualizado_em,
      campos: { preco: 36.5, categoria: "Entradas frias" },
    });
    expect(r.ok).toBe(true);
    expect(c.chamadas[0]?.method).toBe("PATCH");
    expect(c.chamadas[0]?.url.pathname).toBe("/admin/v1/tenants/teste/catalogo/itens/666");
    expect(c.chamadas[0]?.role).toBe(papel);
    expect(c.chamadas[0]?.body).toEqual({
      preco: 36.5,
      categoria: "Entradas frias",
      atualizado_em: "2026-10-13T01:05:26.123456Z",
    });
    if (r.ok) expect(JSON.stringify(r.dados)).toContain("obs interna");
  }
});

test("CAT2 PATCH: atendente, campo não editável e corpo vazio não saem do painel", async () => {
  const m = await montar("funcionario");
  const r = await executarCardapio(m.sessao, {
    acao: "editar",
    item_id: 666,
    atualizado_em: ITEM.atualizado_em,
    campos: { preco: 36.5 },
  });
  expect(r.ok).toBe(false);
  expect(m.chamadas).toHaveLength(0);
  const a = await montar("gestor");
  for (const campos of [
    {},
    { unidade: "X" },
    { papel: "plataforma" },
    { nome: "" },
    { nome: "x".repeat(121) },
  ])
    expect(
      (
        await executarCardapio(a.sessao, {
          acao: "editar",
          item_id: 666,
          atualizado_em: ITEM.atualizado_em,
          campos,
        })
      ).ok,
    ).toBe(false);
  expect(
    (await executarCardapio(a.sessao, { acao: "editar", item_id: 666, campos: { preco: 1 } })).ok,
  ).toBe(false);
  expect(a.chamadas).toHaveLength(0);
});

test("CAT3 409: devolve o item atual ao admin para recarregar ou reaplicar", async () => {
  const atual = { ...ITEM, preco: 38, atualizado_em: "2026-10-13T02:00:00.000001Z" };
  const c = await montar("gestor", [
    Response.json(
      {
        erro: {
          codigo: "CONFLICT",
          mensagem:
            "O item foi alterado por outra pessoa. Confira os dados atuais e salve de novo.",
          detalhes: { campo: "atualizado_em", motivo: "item_alterado" },
        },
        item: atual,
      },
      { status: 409 },
    ),
  ]);
  const r = await executarCardapio(c.sessao, {
    acao: "editar",
    item_id: 666,
    atualizado_em: ITEM.atualizado_em,
    campos: { preco: 36.5 },
  });
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.erro.campo).toBe("atualizado_em");
  expect(r.atual?.preco).toBe(38);
  expect(r.atual?.atualizado_em).toBe("2026-10-13T02:00:00.000001Z");
  expect(JSON.stringify(r.atual)).toContain("obs interna");
});

test("CAT2 validação do servidor: detalhes.campo chega ao campo certo", async () => {
  for (const campo of ["preco", "categoria", "nome", "descricao"]) {
    const c = await montar("gestor", [
      Response.json(
        {
          erro: { codigo: "VALIDATION_ERROR", mensagem: `Confira ${campo}.`, detalhes: { campo } },
        },
        { status: 400 },
      ),
    ]);
    const r = await executarCardapio(c.sessao, {
      acao: "editar",
      item_id: 666,
      atualizado_em: ITEM.atualizado_em,
      campos: { nome: "Edamame" },
    });
    expect(r).toEqual({ ok: false, erro: { campo, mensagem: `Confira ${campo}.` } });
  }
});

test("CAT2 leituras: item e categorias para o funcionário; prévia para o supervisor; histórico só o gestor", async () => {
  const m = await montar("funcionario", [
    Response.json(ITEM),
    Response.json({ unidade: "patio_guedala", categorias: [] }),
    Response.json({ resumo: null, disponivel_agora: true }),
  ]);
  expect((await executarCardapio(m.sessao, { acao: "obter", item_id: 666 })).ok).toBe(true);
  expect(m.chamadas[0]?.url.pathname).toBe("/admin/v1/tenants/teste/catalogo/itens/666");
  await executarCardapio(m.sessao, { acao: "categorias", unidade: "patio_guedala" });
  expect(m.chamadas[1]?.url.pathname).toBe("/admin/v1/tenants/teste/catalogo/categorias");
  expect(m.chamadas[1]?.url.searchParams.get("unidade")).toBe("patio_guedala");
  const regra = {
    dias_semana: ["seg" as const],
    exceto_feriado: true,
    horario: [["11:30", "15:00"]] as [string, string][],
  };
  const sup = await montar("supervisor", [Response.json({ resumo: null, disponivel_agora: true })]);
  await executarCardapio(sup.sessao, {
    acao: "previa",
    unidade: "patio_guedala",
    disponibilidade: regra,
  });
  expect(sup.chamadas[0]?.method).toBe("POST");
  expect(sup.chamadas[0]?.url.pathname).toBe(
    "/admin/v1/tenants/teste/catalogo/disponibilidade/previa",
  );
  expect(sup.chamadas[0]?.body).toEqual({ unidade: "patio_guedala", disponibilidade: regra });
  expect((await executarCardapio(m.sessao, { acao: "historico", item_id: 666 })).ok).toBe(true);
  expect(m.chamadas).toHaveLength(3);

  const a = await montar("gestor", [
    Response.json({
      itens: [
        {
          id: 9,
          actor: "ana",
          entidade: "catalogo_item",
          entidade_id: "666",
          acao: "alterado",
          antes: { preco: 34 },
          depois: { preco: 36.5 },
          criado_em: "2026-10-13T01:05:26Z",
        },
      ],
      proximo_cursor: null,
    }),
  ]);
  const h = await executarCardapio(a.sessao, { acao: "historico", item_id: 666 });
  expect(a.chamadas[0]?.url.pathname).toBe("/admin/v1/tenants/teste/gestao/alteracoes");
  expect(Object.fromEntries(a.chamadas[0]!.url.searchParams)).toEqual({
    entidade: "catalogo_item",
    entidade_id: "666",
  });
  expect(h).toEqual({
    ok: true,
    dados: {
      itens: [
        {
          id: 9,
          actor: "ana",
          acao: "alterado",
          criado_em: "2026-10-13T01:05:26Z",
          antes: { preco: 34 },
          depois: { preco: 36.5 },
        },
      ],
      proximo_cursor: null,
    },
  });
});
