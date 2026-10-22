import { expect, test } from "bun:test";
import { criarClienteGateway } from "./cliente.server";
import { criarModuloGateway, type PapelGateway } from "./modulo.server";
import { executarCardapio } from "./cardapio.server";
import {
  corpoDisponibilidade,
  problemaRascunho,
  rascunhoDe,
  semRestricao,
  type RascunhoDisponibilidade,
} from "./cardapio";
import { filtrarMenu, TENANT_NAV } from "../nav";

const ITEM = {
  item_id: 42,
  codigo: "GUE-0001",
  unidade: "patio_guedala",
  categoria: "Executivos",
  nome: "Executivo do dia",
  descricao: "texto interno do cardápio",
  preco: 59.9,
  alcoolico: false,
  delivery: "sim",
  tipo: "item",
  observacao: "obs interna",
  ativo: true,
  atualizado_em: "2026-10-12T10:00:00-03:00",
  disponibilidade: {
    dias_semana: ["seg", "ter", "qua", "qui", "sex"],
    exceto_feriado: true,
    horario: [["11:30", "15:00"]],
    resumo: "segunda a sexta, 11h30–15h, exceto feriados",
  },
};

async function montar(papel: PapelGateway = "admin", respostas: Response[] = []) {
  const chamadas: {
    url: string;
    role: string | null;
    actor: string | null;
    body: unknown;
    method: string | undefined;
  }[] = [];
  const modulo = criarModuloGateway({
    carregarPerfil: async () => ({
      userId: "u",
      email: "sessao@teste.com",
      superAdmin: papel === "plataforma",
      vinculos: [{ gatewayTenantId: "teste", ativo: true, admin: papel === "admin" }],
    }),
    cliente: criarClienteGateway({
      url: "http://gateway/admin/v1",
      chave: "chave-sintetica-testes",
      fetch: (async (url: URL, init: RequestInit) => {
        const h = new Headers(init.headers);
        chamadas.push({
          url: String(url),
          role: h.get("X-Role"),
          actor: h.get("X-Actor"),
          method: init.method,
          body: init.body ? JSON.parse(String(init.body)) : null,
        });
        return respostas.shift() ?? Response.json(ITEM);
      }) as typeof fetch,
    }),
  });
  return { sessao: await modulo.sessao({ userId: "u", email: "forjado@teste.com" }), chamadas };
}

const base: RascunhoDisponibilidade = {
  sempre: false,
  dias: ["seg", "ter", "qua", "qui", "sex"],
  excetoFeriado: true,
  faixas: [["11:30", "15:00"]],
};

test("DISP1 rascunho: sem restrição liga 'Sempre disponível'; sem dias cadastrados mostra os sete", () => {
  expect(rascunhoDe(null)).toEqual({
    sempre: true,
    dias: ["seg", "ter", "qua", "qui", "sex", "sab", "dom"],
    excetoFeriado: false,
    faixas: [],
  });
  const r = rascunhoDe({
    dias_semana: [],
    exceto_feriado: true,
    horario: [],
    resumo: "exceto feriados",
  });
  expect(r.sempre).toBe(false);
  expect(r.dias).toHaveLength(7);
  expect(rascunhoDe(ITEM.disponibilidade as never)).toEqual(base);
});

test("DISP1 corpo: null para sempre, sete dias viram lista vazia, dias na ordem da semana", () => {
  expect(corpoDisponibilidade({ ...base, sempre: true })).toBeNull();
  expect(corpoDisponibilidade(base)).toEqual({
    dias_semana: ["seg", "ter", "qua", "qui", "sex"],
    exceto_feriado: true,
    horario: [["11:30", "15:00"]],
  });
  expect(corpoDisponibilidade({ ...base, dias: ["dom", "sab"] })?.dias_semana).toEqual([
    "sab",
    "dom",
  ]);
  const todos = { ...base, dias: rascunhoDe(null).dias };
  expect(corpoDisponibilidade(todos)?.dias_semana).toEqual([]);
  expect(semRestricao({ ...todos, excetoFeriado: false, faixas: [] })).toBe(true);
  expect(semRestricao(base)).toBe(false);
});

test("DISP1 validação: pelo menos um dia; faixas HH:MM sem sobreposição; madrugada aceita", () => {
  expect(problemaRascunho(base)).toBeNull();
  expect(problemaRascunho({ ...base, sempre: true, dias: [] })).toBeNull();
  expect(problemaRascunho({ ...base, dias: [] })).toContain("pelo menos um dia");
  expect(problemaRascunho({ ...base, faixas: [["12:00", "12:00"]] })).not.toBeNull();
  expect(
    problemaRascunho({
      ...base,
      faixas: [
        ["11:00", "15:00"],
        ["14:00", "16:00"],
      ],
    }),
  ).not.toBeNull();
  expect(problemaRascunho({ ...base, faixas: [["22:00", "02:00"]] })).toBeNull();
  expect(problemaRascunho({ ...base, faixas: [] })).toBeNull();
});

test("DISP1 lista: membro lê, projeção com descrição e sem observação interna, filtros e paginação", async () => {
  const c = await montar("membro", [Response.json({ itens: [ITEM], proximo_cursor: 42 })]);
  const r = await executarCardapio(c.sessao, {
    acao: "listar",
    q: " executivo ",
    unidade: "patio_guedala",
    cursor: 10,
  });
  expect(r.ok).toBe(true);
  const url = new URL(c.chamadas[0]!.url);
  expect(url.pathname).toBe("/admin/v1/tenants/teste/catalogo/itens");
  expect(url.searchParams.get("q")).toBe("executivo");
  expect(url.searchParams.get("unidade")).toBe("patio_guedala");
  expect(url.searchParams.get("cursor")).toBe("10");
  expect(url.searchParams.get("limite")).toBe("100");
  expect(c.chamadas[0]?.role).toBe("membro");
  expect(c.chamadas[0]?.method).toBe("GET");
  const dados = (r as { dados: { itens: Record<string, unknown>[]; proximo_cursor: number } })
    .dados;
  expect(dados.proximo_cursor).toBe(42);
  expect(dados.itens[0]?.["disponibilidade"]).toEqual(ITEM.disponibilidade);
  expect(dados.itens[0]?.["descricao"]).toBe(ITEM.descricao);
  expect(JSON.stringify(dados)).not.toContain("obs interna");
});

test("DISP1 PATCH: admin e plataforma enviam {disponibilidade, atualizado_em}; null tira a restrição", async () => {
  for (const papel of ["admin", "plataforma"] as const) {
    const c = await montar(papel);
    const corpo = corpoDisponibilidade(base);
    const r = await executarCardapio(c.sessao, {
      empresa: "teste",
      acao: "disponibilidade",
      item_id: 42,
      atualizado_em: ITEM.atualizado_em,
      disponibilidade: corpo,
    });
    expect(r.ok).toBe(true);
    expect(c.chamadas[0]?.method).toBe("PATCH");
    expect(new URL(c.chamadas[0]!.url).pathname).toBe("/admin/v1/tenants/teste/catalogo/itens/42");
    expect(c.chamadas[0]?.body).toEqual({
      disponibilidade: corpo,
      atualizado_em: ITEM.atualizado_em,
    });
    expect(c.chamadas[0]?.role).toBe(papel);
    expect(c.chamadas[0]?.actor).toBe("sessao@teste.com");
    await executarCardapio(c.sessao, {
      empresa: "teste",
      acao: "disponibilidade",
      item_id: 42,
      atualizado_em: ITEM.atualizado_em,
      disponibilidade: null,
    });
    expect(c.chamadas[1]?.body).toEqual({
      disponibilidade: null,
      atualizado_em: ITEM.atualizado_em,
    });
  }
});

test("DISP1 PATCH: membro recusado antes do gateway; corpo inválido não sai do painel", async () => {
  const m = await montar("membro");
  const r = await executarCardapio(m.sessao, {
    acao: "disponibilidade",
    item_id: 42,
    atualizado_em: ITEM.atualizado_em,
    disponibilidade: null,
  });
  expect(r.ok).toBe(false);
  expect(m.chamadas).toHaveLength(0);
  const a = await montar("admin");
  for (const disponibilidade of [
    { dias_semana: ["xyz"], exceto_feriado: false, horario: [] },
    { dias_semana: ["seg"], exceto_feriado: false, horario: [["25:00", "26:00"]] },
    {
      dias_semana: ["seg"],
      exceto_feriado: false,
      horario: [
        ["11:00", "15:00"],
        ["14:00", "16:00"],
      ],
    },
    { dias_semana: ["seg"], exceto_feriado: false, horario: [], resumo: "forjado" },
  ])
    expect(
      (
        await executarCardapio(a.sessao, {
          acao: "disponibilidade",
          item_id: 42,
          atualizado_em: ITEM.atualizado_em,
          disponibilidade,
        })
      ).ok,
    ).toBe(false);
  expect(
    (
      await executarCardapio(a.sessao, {
        acao: "disponibilidade",
        item_id: 42,
        atualizado_em: ITEM.atualizado_em,
        disponibilidade: null,
        nome: "outro campo",
      })
    ).ok,
  ).toBe(false);
  expect(a.chamadas).toHaveLength(0);
});

test("DISP1 isolamento: empresa alheia recusada; erro do gateway vira mensagem do campo", async () => {
  const c = await montar("admin");
  await expect(executarCardapio(c.sessao, { empresa: "outra", acao: "listar" })).rejects.toThrow();
  expect(c.chamadas).toHaveLength(0);
  const e = await montar("admin", [
    Response.json(
      {
        erro: {
          codigo: "VALIDATION_ERROR",
          mensagem: "Confira os campos informados.",
          detalhes: { campo: "disponibilidade" },
        },
      },
      { status: 400 },
    ),
  ]);
  const r = await executarCardapio(e.sessao, {
    acao: "disponibilidade",
    item_id: 42,
    atualizado_em: ITEM.atualizado_em,
    disponibilidade: corpoDisponibilidade(base),
  });
  expect(r).toEqual({
    ok: false,
    erro: { campo: "disponibilidade", mensagem: expect.stringContaining("disponibilidade") },
  });
});

test("DISP1 menu: Cardápio para admin e atendente da empresa", () => {
  for (const papel of ["admin", "membro"] as const)
    expect(filtrarMenu(TENANT_NAV, papel).some((i) => i.to === "/ia/cardapio")).toBe(true);
});

test("Cardápio UX panorama atravessa todas as páginas para contagem e busca completas", async () => {
  const c = await montar("membro", [
    Response.json({ itens: [ITEM], proximo_cursor: 42 }),
    Response.json({ itens: [{ ...ITEM, item_id: 43 }], proximo_cursor: null }),
  ]);
  const r = await executarCardapio(c.sessao, { acao: "panorama" });
  expect(r.ok).toBe(true);
  if (r.ok) expect((r.dados as unknown as { itens: unknown[] }).itens).toHaveLength(2);
  expect(c.chamadas).toHaveLength(2);
  expect(new URL(c.chamadas[1]!.url).searchParams.get("cursor")).toBe("42");
});
test("Cardápio UX panorama recusa cursor parado, nunca retorna contagem parcial", async () => {
  const c = await montar("membro", [Response.json({ itens: [ITEM], proximo_cursor: 0 })]);
  expect((await executarCardapio(c.sessao, { acao: "panorama" })).ok).toBe(false);
  expect(c.chamadas).toHaveLength(1);
  const outro = await montar();
  await expect(
    executarCardapio(outro.sessao, { acao: "panorama", empresa: "outra" }),
  ).rejects.toThrow();
  expect(outro.chamadas).toHaveLength(0);
});
