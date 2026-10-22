import { test, expect } from "bun:test";
import { criarClienteGateway } from "./cliente.server";
import { criarModuloGateway, autorizar, type PapelGateway } from "./modulo.server";
import { executarCat3 } from "./cat3.server";
import { executarEnc1 } from "./enc1.server";
import { motivoAtendimento } from "./enc1";
import { executarCardapio } from "./cardapio.server";
import { cat3Schema, moverNaOrdem, ordenarItens, type PedidoCat3 } from "./cat3";
import type { ItemCardapio } from "./cardapio";
const item = {
  item_id: 1,
  nome: "Edamame",
  codigo: "A-1",
  categoria: "Entradas",
  categoria_id: 2,
  unidade: "morumbi",
  preco: 32,
  tipo: "item",
  ativo: true,
  observacao: "Nota interna",
  disponibilidade: null,
  atualizado_em: "2026-10-20T10:00:00.123456Z",
  esgotado_ate: null,
  arquivado: false,
};
async function montar(
  papel: PapelGateway = "admin",
  responder: (u: URL) => Response = () => Response.json(item),
) {
  const chamadas: { url: URL; metodo: string; corpo: unknown; headers: Headers }[] = [];
  const m = criarModuloGateway({
    carregarPerfil: async () => ({
      userId: "real",
      email: "sessao@teste.local",
      superAdmin: papel === "plataforma",
      vinculos: [{ gatewayTenantId: "teste", ativo: true, admin: papel === "admin" }],
    }),
    cliente: criarClienteGateway({
      url: "http://gateway/admin/v1",
      chave: "sintetica-testes",
      fetch: (async (u: URL, init: RequestInit) => {
        chamadas.push({
          url: new URL(String(u)),
          metodo: init.method!,
          corpo: init.body ? JSON.parse(String(init.body)) : null,
          headers: new Headers(init.headers),
        });
        return responder(new URL(String(u)));
      }) as typeof fetch,
    }),
  });
  return { s: await m.sessao({ userId: "real", email: "forjado" }), chamadas };
}
const operacoes: PedidoCat3[] = [
  {
    acao: "criar",
    campos: {
      unidade: "morumbi",
      categoria_id: 2,
      nome: "Novo",
      descricao: null,
      preco: 10,
      tipo: "item",
      alcoolico: false,
      delivery: "sim",
      ativo: true,
      observacao: null,
      disponibilidade: null,
    },
  },
  { acao: "item", id: 1, operacao: "duplicar" },
  { acao: "item", id: 1, operacao: "arquivar" },
  { acao: "item", id: 1, operacao: "desarquivar" },
  { acao: "categoria_criar", unidade: "morumbi", nome: "Nova" },
  { acao: "categoria_renomear", id: 2, nome: "Nova" },
  { acao: "categoria_arquivar", id: 2, itens: "mover", destino: 3 },
  { acao: "ordenar_categorias", unidade: "morumbi", categorias: [2, 3] },
  { acao: "ordenar_itens", id: 2, itens: [1, 2] },
  { acao: "copiar", itens: [1], destino: "einstein", ligar: true },
  { acao: "lote", itens: [1], operacao: "reajustar", simulacao: true, percentual: 5 },
  { acao: "ligar", grupos: [{ chave: "edamame", itens: [1, 2] }] },
  { acao: "sugestoes_acao", operacao: "ignorar", chaves: ["edamame"] },
  { acao: "sugestoes_acao", operacao: "restaurar", chaves: ["edamame"] },
];
test("CAT3 admin e plataforma: rotas explícitas, papel e actor da sessão; todas as operações", async () => {
  for (const papel of ["admin", "plataforma"] as const) {
    for (const d of operacoes) {
      const c = await montar(papel);
      const r = await executarCat3(c.s, { ...d, empresa: "teste" });
      expect(r.ok).toBe(true);
      expect(c.chamadas).toHaveLength(1);
      expect(c.chamadas[0]!.headers.get("X-Actor")).toBe("sessao@teste.local");
      expect(c.chamadas[0]!.headers.get("X-Role")).toBe(papel);
      expect(c.chamadas[0]!.url.pathname).toStartWith("/admin/v1/tenants/teste/catalogo/");
    }
  }
});
test("CAT3 membro: só esgotar/repor; lote e todos os outros comandos recusados antes da rede", async () => {
  for (const d of [
    ...operacoes,
    { acao: "lote", itens: [1], operacao: "esgotar", simulacao: false } as PedidoCat3,
  ]) {
    const c = await montar("membro");
    const r = await executarCat3(c.s, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.status).toBe(403);
    expect(c.chamadas).toHaveLength(0);
  }
  for (const operacao of ["esgotar", "repor"] as const) {
    const c = await montar("membro");
    const r = await executarCat3(c.s, { acao: "item", id: 1, operacao });
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.dados)).not.toContain("Nota interna");
    expect(c.chamadas[0]!.corpo).toEqual(operacao === "esgotar" ? { ate: "fim_do_dia" } : null);
  }
});
test("CAT3 isolamento de todas as operações e cabeçalhos forjados", async () => {
  for (const d of operacoes) {
    const c = await montar();
    expect((await executarCat3(c.s, { ...d, empresa: "outra" })).ok).toBe(false);
    expect((await executarCat3(c.s, { ...d, actor: "forjado", papel: "plataforma" })).ok).toBe(
      false,
    );
    expect(c.chamadas).toHaveLength(0);
  }
});
test("CAT3 PATCH parcial preserva microssegundos, alcance, resultado parcial e notas só admin", async () => {
  const c = await montar("admin", () =>
    Response.json({
      ...item,
      aplicado_em: [
        { unidade: "morumbi", item_id: 1, ok: true },
        { unidade: "einstein", item_id: 2, ok: false, motivo: "inexistente" },
      ],
    }),
  );
  const r = await executarCardapio(c.s, {
    acao: "editar",
    item_id: 1,
    atualizado_em: item.atualizado_em,
    campos: { nome: "Novo", aplicar_em: "todas" },
  });
  expect(r.ok).toBe(true);
  expect(c.chamadas[0]!.corpo).toEqual({
    nome: "Novo",
    aplicar_em: "todas",
    atualizado_em: item.atualizado_em,
  });
  if (r.ok) {
    expect(JSON.stringify(r.dados)).toContain("Nota interna");
    expect(JSON.stringify(r.dados)).toContain("inexistente");
  }
  expect(() =>
    autorizar("membro", "PATCH", ["catalogo", "itens", "1"], { ativo: false }),
  ).toThrow();
});
test("CAT3 valida lote: não repete IDs, até 500, percentual ou valor, mover exige categoria", async () => {
  expect(
    cat3Schema.safeParse({ acao: "lote", itens: [1, 1], operacao: "ativar", simulacao: false })
      .success,
  ).toBe(false);
  expect(
    cat3Schema.safeParse({
      acao: "lote",
      itens: Array.from({ length: 501 }, (_, i) => i + 1),
      operacao: "ativar",
      simulacao: false,
    }).success,
  ).toBe(false);
  for (const d of [
    { operacao: "reajustar", percentual: 3, valor: 2 },
    { operacao: "reajustar" },
    { operacao: "mover" },
  ]) {
    const c = await montar();
    expect((await executarCat3(c.s, { acao: "lote", itens: [1], simulacao: true, ...d })).ok).toBe(
      false,
    );
    expect(c.chamadas).toHaveLength(0);
  }
});
test("CAT3 simulação e aplicação são chamadas distintas; mantém falhas por item", async () => {
  const resposta = {
    simulacao: true,
    resultados: [
      { item_id: 1, ok: true, antes: { preco: 10 }, depois: { preco: 11 } },
      { item_id: 2, ok: false, motivo: "sem_preco" },
    ],
  };
  const c = await montar("admin", () => Response.json(resposta));
  const r = await executarCat3(c.s, {
    acao: "lote",
    itens: [1, 2],
    operacao: "reajustar",
    percentual: 10,
    simulacao: true,
  });
  expect(c.chamadas).toHaveLength(1);
  expect(c.chamadas[0]!.corpo).toEqual({
    itens: [1, 2],
    acao: "reajustar",
    simulacao: true,
    percentual: 10,
  });
  if (r.ok) expect(r.dados).toEqual(resposta);
});
test("CAT3 categorias ordem, erro no campo, sugestões com cursor e grupos explícitos", async () => {
  expect(moverNaOrdem([1, 2, 3], 3, 1)).toEqual([3, 1, 2]);
  expect(
    ordenarItens([
      { ...item, item_id: 1, nome: "Z", posicao: 0 },
      { ...item, item_id: 2, nome: "A", posicao: null },
    ] as ItemCardapio[]).map((i) => i.item_id),
  ).toEqual([1, 2]);
  const c = await montar("admin", () =>
    Response.json(
      {
        erro: {
          codigo: "VALIDATION_ERROR",
          mensagem: "Nome já usado.",
          detalhes: { campo: "nome" },
        },
      },
      { status: 400 },
    ),
  );
  const r = await executarCat3(c.s, { acao: "categoria_criar", unidade: "morumbi", nome: "X" });
  if (r.ok) throw Error("Esperava erro");
  expect(r.erro.campo).toBe("nome");
  expect(r.erro.mensagem).toBe("Nome já usado.");
  const s = await montar();
  await executarCat3(s.s, { acao: "sugestoes", ignoradas: true, cursor: "edamame" });
  expect(s.chamadas[0]!.url.searchParams.get("cursor")).toBe("edamame");
  expect(s.chamadas[0]!.url.searchParams.get("ignoradas")).toBe("true");
});
test("ENC1 admin/membro: listar paginado, encerrar e reabrir; actor real", async () => {
  for (const papel of ["admin", "membro"] as const) {
    for (const acao of ["listar", "encerrar", "reabrir"] as const) {
      const c = await montar(papel, (u) =>
        u.pathname.endsWith("/canal")
          ? Response.json({ agente_id: null })
          : Response.json({ itens: [], proximo_cursor: null }),
      );
      const r = await executarEnc1(c.s, { acao, conversa: "teste:canal:cliente", cursor: 2 });
      expect(r.ok).toBe(true);
      const ultima = c.chamadas.at(-1)!;
      expect(ultima.url.pathname).toEndWith(acao === "listar" ? "/atendimentos" : `/${acao}`);
      expect(ultima.headers.get("X-Actor")).toBe("sessao@teste.local");
      expect(ultima.headers.get("X-Role")).toBe(papel);
      if (acao === "listar") expect(ultima.url.searchParams.get("cursor")).toBe("2");
      else expect(ultima.corpo).toEqual(acao === "encerrar" ? { motivo: "manual" } : null);
    }
  }
});
test("ENC1 tenant alheio, actor forjado, conversa oculta e conflito 409", async () => {
  const c = await montar();
  for (const d of [{ empresa: "outra" }, { actor: "forjado" }])
    expect(
      (await executarEnc1(c.s, { acao: "reabrir", conversa: "teste:canal:cliente", ...d })).ok,
    ).toBe(false);
  expect(c.chamadas).toHaveLength(0);
  const oculto = await montar("membro", (u) =>
    u.pathname.endsWith("/canal")
      ? Response.json({ agente_id: "ag1" })
      : Response.json({ itens: [{ id: "ag1", nome: "[teste] Interno" }], proximo_cursor: null }),
  );
  expect(
    (await executarEnc1(oculto.s, { acao: "encerrar", conversa: "teste:canal:cliente" })).ok,
  ).toBe(false);
  expect(oculto.chamadas.some((c) => c.metodo === "POST")).toBe(false);
  const conflito = await montar("plataforma", () =>
    Response.json({ erro: { codigo: "CONFLICT", mensagem: "NADA_A_REABRIR" } }, { status: 409 }),
  );
  const r = await executarEnc1(conflito.s, {
    empresa: "teste",
    acao: "reabrir",
    conversa: "teste:canal:cliente",
  });
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.status).toBe(409);
    expect(r.mensagem).toContain("último atendimento");
  }
  const encerrar = await executarEnc1(conflito.s, {
    empresa: "teste",
    acao: "encerrar",
    conversa: "teste:canal:cliente",
  });
  expect(encerrar.ok).toBe(false);
  if (!encerrar.ok) {
    expect(encerrar.status).toBe(409);
    expect(encerrar.mensagem).toContain("Não há atendimento aberto");
  }
  expect(motivoAtendimento("pedido_concluido")).toBe("Pedido concluído e o cliente agradeceu");
  expect(motivoAtendimento("retorno_apos_encerramento")).toBe("Retorno após encerramento");
});

test("CAT3 esgotados usa filtro do gateway, mesmo quando motivo principal é sem preço; arquivados isolados", async () => {
  const c = await montar("admin", (u) =>
    Response.json({
      itens:
        u.searchParams.get("esgotados") === "true"
          ? [{ item_id: 1 }]
          : [{ ...item, preco: null, indisponivel_motivo: "sem_preco", arquivado: true }],
      proximo_cursor: null,
    }),
  );
  const r = await executarCardapio(c.s, {
    acao: "panorama",
    com_esgotados: true,
    arquivados: true,
  });
  expect(r.ok).toBe(true);
  expect(c.chamadas).toHaveLength(2);
  expect(c.chamadas.every((c) => c.url.searchParams.get("arquivados") === "true")).toBe(true);
  if (r.ok) expect((r.dados as { itens: ItemCardapio[] }).itens[0]!.esgotado_agora).toBe(true);
});
