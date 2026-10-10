import { test, expect } from "bun:test";
import { executarGestao } from "./gestao.server";
import { criarModuloGateway } from "./modulo.server";
import { criarClienteGateway } from "./cliente.server";
import { problemaGrade, textoSituacao, dataRecebida, instanteLocal, type Situacao } from "./gestao";
const s: Situacao = {
  aberta_agora: null,
  motivo: "sem_horario",
  fecha_as: null,
  proxima_abertura: null,
  pausada_ate: null,
};
async function montar(papel = "admin", respostas: Response[] = []) {
  const chamadas: {
    url: string;
    method: string | undefined;
    headers: HeadersInit | undefined;
    body: unknown;
  }[] = [];
  const modulo = criarModuloGateway({
    carregarPerfil: async () => ({
      userId: "u",
      email: "sessao@exemplo.com",
      superAdmin: papel === "plataforma",
      vinculos: [{ gatewayTenantId: "bykoji", ativo: true, admin: papel === "admin" }],
    }),
    cliente: criarClienteGateway({
      url: "http://gateway:8000/admin/v1",
      chave: "sintetica-nao-segredo-real-123456",
      fetch: (async (url: URL, init: RequestInit) => {
        chamadas.push({
          url: String(url),
          method: init.method,
          headers: init.headers,
          body: init.body ? JSON.parse(String(init.body)) : null,
        });
        return (
          respostas.shift() ??
          Response.json({
            id: "uni",
            nome: "Teste",
            horarios: { seg: [["12:00", "15:00"]] },
            situacao: s,
            taxa_entrega: 10,
            whatsapp_pedidos: "5511999999999",
          })
        );
      }) as typeof fetch,
    }),
  });
  return { sessao: await modulo.sessao({ userId: "u", email: null }), chamadas };
}
test("G1 isolamento: empresa alheia recusada em todas as ações", async () => {
  const ops = [
    { acao: "listar" },
    { acao: "obter", id: "uni" },
    { acao: "agenda", id: "uni" },
    { acao: "criar", dados: { nome: "x" } },
    { acao: "editar", id: "uni", dados: { nome: "x" } },
    { acao: "horarios", id: "uni", grade: {} },
    { acao: "pausar", id: "uni", indefinida: true },
    { acao: "reabrir", id: "uni" },
    { acao: "excecoes", id: "uni" },
    { acao: "excecao", id: "uni", data: "2026-12-25", fechado: true },
    { acao: "excluir_excecao", id: "uni", eid: 1 },
    { acao: "historico" },
  ];
  for (const op of ops) {
    const c = await montar();
    await expect(executarGestao(c.sessao, { ...op, empresa: "outro" })).rejects.toThrow();
    expect(c.chamadas).toHaveLength(0);
  }
});
test("G1 membro lê unidade/agenda e pausa/reabre, sem grade nem configurações privadas", async () => {
  for (const op of [
    { acao: "obter", id: "uni" },
    { acao: "agenda", id: "uni" },
    { acao: "pausar", id: "uni", indefinida: true },
    { acao: "reabrir", id: "uni" },
  ]) {
    const c = await montar("membro");
    const r = await executarGestao(c.sessao, { ...op, empresa: "bykoji" });
    expect(r.ok).toBe(true);
    if (op.acao !== "agenda") {
      expect(JSON.stringify(r)).not.toContain("horarios");
      expect(JSON.stringify(r)).not.toContain("whatsapp_pedidos");
      expect(JSON.stringify(r)).not.toContain("taxa_entrega");
    }
  }
});
test("G1 membro não altera unidade, grade, exceções nem lê histórico", async () => {
  for (const op of [
    { acao: "editar", id: "uni", dados: { nome: "x" } },
    { acao: "criar", dados: { nome: "x" } },
    { acao: "horarios", id: "uni", grade: {} },
    { acao: "excecoes", id: "uni" },
    { acao: "excecao", id: "uni", data: "2026-12-25", fechado: true },
    { acao: "excluir_excecao", id: "uni", eid: 1 },
    { acao: "historico" },
  ]) {
    const c = await montar("membro");
    await expect(executarGestao(c.sessao, { ...op, empresa: "bykoji" })).rejects.toThrow();
    expect(c.chamadas).toHaveLength(0);
  }
});
test("G1 Actor forjado recusado; GET e POST usam sessão", async () => {
  const c = await montar("membro");
  expect((await executarGestao(c.sessao, { acao: "obter", id: "uni", actor: "forjado" })).ok).toBe(
    false,
  );
  expect(c.chamadas).toHaveLength(0);
  await executarGestao(c.sessao, { acao: "obter", id: "uni" });
  await executarGestao(c.sessao, { acao: "pausar", id: "uni", indefinida: true });
  for (const r of c.chamadas)
    expect(new Headers(r.headers).get("X-Actor")).toBe("sessao@exemplo.com");
  expect(
    (
      await executarGestao(c.sessao, {
        acao: "pausar",
        id: "uni",
        indefinida: true,
        dados: { ativo: false },
      })
    ).ok,
  ).toBe(false);
});
test("G1 grade HH:MM, meia-noite e sobreposição inclusive domingo/segunda", () => {
  expect(problemaGrade({})).toBeNull();
  expect(problemaGrade({ sex: [["19:00", "02:00"]] })).toBeNull();
  expect(
    problemaGrade({
      seg: [
        ["12:00", "15:00"],
        ["15:00", "18:00"],
      ],
    }),
  ).toBeNull();
  for (const g of [
    { seg: [["12:00", "12:00"]] },
    { seg: [["24:00", "01:00"]] },
    {
      seg: [
        ["12:00", "16:00"],
        ["15:00", "18:00"],
      ],
    },
    { dom: [["23:00", "02:00"]], seg: [["01:00", "03:00"]] },
  ])
    expect(problemaGrade(g as Parameters<typeof problemaGrade>[0])).not.toBeNull();
});
test("G1 envia grade inteira; rejeição 400 aparece no campo", async () => {
  const c = await montar("admin", [
    Response.json(
      {
        erro: {
          codigo: "VALIDATION_ERROR",
          mensagem: "Turnos sobrepostos.",
          detalhes: { campo: "horarios", interno: "nunca retornar" },
        },
      },
      { status: 400 },
    ),
  ]);
  const grade = { sex: [["19:00", "02:00"]] };
  const r = await executarGestao(c.sessao, { acao: "horarios", id: "uni", grade });
  expect(c.chamadas[0]?.method).toBe("PUT");
  expect(c.chamadas[0]?.body).toEqual(grade);
  expect(r).toEqual({ ok: false, erro: { campo: "horarios", mensagem: "Turnos sobrepostos." } });
});
test("G1 situação nula, pausa expirada e indefinida são apenas o retorno do gateway", () => {
  expect(textoSituacao(s)).toBe("Horário não informado");
  expect(textoSituacao({ ...s, aberta_agora: false, motivo: "pausa" })).toBe(
    "Pedidos pausados até reabrir",
  );
  expect(
    textoSituacao({
      ...s,
      aberta_agora: true,
      motivo: null,
      pausada_ate: "2000-01-01T10:00:00-03:00",
    }),
  ).toBe("Aberta");
  expect(textoSituacao({ ...s, aberta_agora: false, motivo: "horario" })).toBe(
    "Fechada neste horário",
  );
});
test("G1 pausa: passado, limite de 60 dias, offset e exclusividade; nenhuma chamada inválida", async () => {
  for (const prazo of [
    { ate: "2000-01-01T10:00:00Z" },
    { ate: new Date(Date.now() + 61 * 86400000).toISOString() },
    { ate: "2099-01-01T10:00" },
    { indefinida: true, ate: new Date(Date.now() + 60000).toISOString() },
    {},
  ]) {
    const c = await montar();
    expect((await executarGestao(c.sessao, { acao: "pausar", id: "uni", ...prazo })).ok).toBe(
      false,
    );
    expect(c.chamadas).toHaveLength(0);
  }
  const c = await montar();
  await executarGestao(c.sessao, {
    acao: "pausar",
    id: "uni",
    indefinida: true,
    motivo: "Pausa de teste",
  });
  expect(c.chamadas[0]?.body).toEqual({ indefinida: true, motivo: "Pausa de teste" });
});
test("G1 exceção substitui a mesma data pelo POST; campos mutuamente exclusivos", async () => {
  const c = await montar();
  for (const corpo of [
    { data: "2026-12-25", fechado: true },
    { data: "2026-12-25", faixas: [["12:00", "16:00"]] },
  ])
    expect((await executarGestao(c.sessao, { acao: "excecao", id: "uni", ...corpo })).ok).toBe(
      true,
    );
  expect(c.chamadas[0]?.url).toBe(c.chamadas[1]?.url);
  expect(c.chamadas.every((x) => x.method === "POST")).toBe(true);
  expect(
    (
      await executarGestao(c.sessao, {
        acao: "excecao",
        id: "uni",
        data: "2026-12-25",
        fechado: true,
        faixas: [["12:00", "16:00"]],
      })
    ).ok,
  ).toBe(false);
});
test("G1 datas preservam offset, sem offset é horário do servidor; input no fuso da unidade", () => {
  expect(dataRecebida("2026-10-10T12:30:00-03:00")).toBe("10/10/2026 12:30 (UTC-03:00)");
  expect(dataRecebida("2026-10-10T12:30:00")).toBe("10/10/2026 12:30 (horário do servidor)");
  expect(instanteLocal("2026-10-10T19:00", "America/Sao_Paulo")).toBe("2026-10-10T19:00:00-03:00");
  expect(() => instanteLocal("2026-03-08T02:30", "America/New_York")).toThrow();
  expect(() => instanteLocal("2026-11-01T01:30", "America/New_York")).toThrow();
});
test("G1 telefone DDI 10–15 normalizado e PATCH parcial não apaga outros campos", async () => {
  const c = await montar();
  await executarGestao(c.sessao, {
    acao: "editar",
    id: "uni",
    dados: { whatsapp_pedidos: "+55 (11) 99999-9999" },
  });
  expect(c.chamadas[0]?.body).toEqual({ whatsapp_pedidos: "5511999999999" });
  expect(
    (await executarGestao(c.sessao, { acao: "editar", id: "uni", dados: { telefone: "123" } })).ok,
  ).toBe(false);
});
test("G1 histórico só parâmetros publicados, máscara preservada", async () => {
  const c = await montar("admin", [
    Response.json({
      itens: [{ antes: { whatsapp_pedidos: "5511****9999" }, depois: { whatsapp_pedidos: null } }],
      proximo_cursor: 5,
    }),
  ]);
  const r = await executarGestao(c.sessao, {
    acao: "historico",
    entidade: "unidade",
    entidade_id: "uni",
    cursor: 12,
  });
  expect(r.ok).toBe(true);
  expect(JSON.stringify(r)).toContain("5511****9999");
  expect(c.chamadas[0]?.url).toContain("cursor=12");
  expect((await executarGestao(c.sessao, { acao: "historico", desde: "2026-01-01" })).ok).toBe(
    false,
  );
});
