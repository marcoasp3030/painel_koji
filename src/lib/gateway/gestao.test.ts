import { test, expect } from "bun:test";
import { executarGestao } from "./gestao.server";
import { criarModuloGateway } from "./modulo.server";
import { criarClienteGateway } from "./cliente.server";
import {
  problemaGrade,
  textoSituacao,
  dataRecebida,
  instanteLocal,
  periodoNoFuso,
  instanteDaqui,
  fimDeTurnoUtil,
  feriadosNacionais,
  alertasUnidade,
  gradeCopiada,
  pendentesDe,
  cidadeUf,
  UFS,
  type Situacao,
} from "./gestao";
const s: Situacao = {
  aberta_agora: null,
  motivo: "sem_horario",
  fecha_as: null,
  proxima_abertura: null,
  pausada_ate: null,
};
/** Ignora o GET /modulos que antecede leituras/escritas de unidade (MULTI1-a). */
function chamadaUnidade(c: {
  chamadas: { url: string; method: string | undefined; body: unknown }[];
}) {
  return c.chamadas.find((x) => !x.url.includes("/modulos"));
}
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
        if (String(url).includes("/modulos")) {
          return Response.json({ itens: [], em_uso: [], telas: [] });
        }
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
    { acao: "fuso_empresa" },
    { acao: "aplicar_pausas", ids: ["uni"], indefinida: true },
    { acao: "aplicar_excecoes", itens: [{ id: "uni", data: "2026-12-25", fechado: true }] },
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
    { acao: "fuso_empresa" },
    { acao: "aplicar_pausas", ids: ["uni"], indefinida: true },
    { acao: "aplicar_excecoes", itens: [{ id: "uni", data: "2026-12-25", fechado: true }] },
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
  const h = chamadaUnidade(c);
  expect(h?.method).toBe("PUT");
  expect(h?.body).toEqual(grade);
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
  expect(chamadaUnidade(c)?.body).toEqual({ indefinida: true, motivo: "Pausa de teste" });
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
  expect(chamadaUnidade(c)?.body).toEqual({ whatsapp_pedidos: "5511999999999" });
  expect(
    (await executarGestao(c.sessao, { acao: "editar", id: "uni", dados: { telefone: "123" } })).ok,
  ).toBe(false);
});
test("CAL1 cidade e UF: gravadas pelo PATCH, UF só das 27, lidas por qualquer papel", async () => {
  const c = await montar();
  const r = await executarGestao(c.sessao, {
    acao: "editar",
    id: "uni",
    dados: { cidade: "  Campinas ", uf: "SP" },
  });
  expect(r.ok).toBe(true);
  const p1 = chamadaUnidade(c)!;
  expect(p1.method).toBe("PATCH");
  expect(p1.url).toContain("/admin/v1/tenants/bykoji/unidades/uni");
  expect(p1.body).toEqual({ cidade: "Campinas", uf: "SP" });
  await executarGestao(c.sessao, { acao: "editar", id: "uni", dados: { cidade: null, uf: null } });
  const patches = c.chamadas.filter((x) => x.method === "PATCH");
  expect(patches[1]?.body).toEqual({ cidade: null, uf: null });
  for (const dados of [{ uf: "XX" }, { uf: "sp" }, { cidade: "a".repeat(81) }, { cidade: "  " }])
    expect((await executarGestao(c.sessao, { acao: "editar", id: "uni", dados })).ok).toBe(false);
  expect(c.chamadas.filter((x) => x.method === "PATCH")).toHaveLength(2);
  const m = await montar("membro", [
    Response.json({
      itens: [{ id: "uni", nome: "T", cidade: "São Paulo", uf: "SP", situacao: s }],
    }),
  ]);
  const lista = await executarGestao(m.sessao, { acao: "listar" });
  expect(JSON.stringify(lista)).toContain('"cidade":"São Paulo","uf":"SP"');
  expect(cidadeUf({ cidade: "São Paulo", uf: "SP" })).toBe("São Paulo/SP");
  expect(cidadeUf({ cidade: "São Paulo", uf: null })).toBe("São Paulo");
  expect(cidadeUf({ cidade: null, uf: "SP" })).toBeNull();
  expect(UFS).toHaveLength(27);
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
  const antes = c.chamadas.length;
  const filtrado = await executarGestao(c.sessao, {
    acao: "historico",
    unidade_id: "uni",
    desde: "2026-10-01T00:00:00-03:00",
    ate: "2026-10-11T00:00:00-03:00",
  });
  expect(filtrado.ok).toBe(true);
  const url = new URL(c.chamadas.at(-1)!.url);
  expect(url.searchParams.get("unidade_id")).toBe("uni");
  expect(url.searchParams.get("desde")).toBe("2026-10-01T00:00:00-03:00");
  expect(url.searchParams.get("ate")).toBe("2026-10-11T00:00:00-03:00");
  expect(url.searchParams.has("entidade")).toBe(false);
  expect(c.chamadas.length).toBe(antes + 1);
  expect(
    (
      await executarGestao(c.sessao, {
        acao: "historico",
        unidade_id: "uni",
        entidade: "unidade",
      })
    ).ok,
  ).toBe(false);
  expect(c.chamadas.length).toBe(antes + 1);
});
test("G1 período do histórico inclui o dia final e usa o fuso informado", () => {
  expect(periodoNoFuso("2026-10-10", "2026-10-10")).toEqual({
    desde: "2026-10-10T00:00:00-03:00",
    ate: "2026-10-11T00:00:00-03:00",
  });
  expect(periodoNoFuso("2026-10-10", "2026-10-10", "America/Manaus")).toEqual({
    desde: "2026-10-10T00:00:00-04:00",
    ate: "2026-10-11T00:00:00-04:00",
  });
});
test("G1 pausa rápida, feriados, alertas, cópia de grade e retomada sem repetir sucesso", () => {
  const agora = Date.parse("2026-10-10T18:00:00-03:00");
  expect(instanteDaqui(30, "America/Sao_Paulo", agora)).toBe("2026-10-10T18:30:00-03:00");
  expect(instanteDaqui(60, "America/Sao_Paulo", agora)).toBe("2026-10-10T19:00:00-03:00");
  expect(fimDeTurnoUtil("2026-10-10T22:00:00-03:00", agora)).toBe("2026-10-10T22:00:00-03:00");
  expect(fimDeTurnoUtil(null, agora)).toBeNull();
  expect(fimDeTurnoUtil("2026-10-10T17:00:00-03:00", agora)).toBeNull();
  const feriados = feriadosNacionais(2026);
  expect(feriados.find((f) => f.nome === "Sexta-feira Santa")?.data).toBe("2026-04-03");
  expect(feriados.find((f) => f.nome === "Segunda-feira de Carnaval")?.data).toBe("2026-02-16");
  expect(feriados.find((f) => f.nome === "Terça-feira de Carnaval")?.data).toBe("2026-02-17");
  expect(feriados.find((f) => f.nome === "Corpus Christi")?.data).toBe("2026-06-04");
  expect(feriados.find((f) => f.nome === "Natal")?.data).toBe("2026-12-25");
  expect(feriados.find((f) => f.nome === "Consciência Negra")?.data).toBe("2026-11-20");
  expect(feriadosNacionais(2025).find((f) => f.nome === "Sexta-feira Santa")?.data).toBe(
    "2025-04-18",
  );
  const base = { ativo: true, situacao: s, whatsapp_pedidos: null as string | null };
  expect(alertasUnidade(base, true)).toEqual({
    semHorario: true,
    semWhatsapp: true,
    semCidade: true,
  });
  expect(alertasUnidade({ ...base, cidade: "São Paulo" }, false).semCidade).toBe(false);
  expect(alertasUnidade({ ...base, ativo: false }, false).semCidade).toBe(false);
  expect(alertasUnidade({ ...base, ativo: false }, true).semHorario).toBe(false);
  expect(alertasUnidade(base, false).semWhatsapp).toBe(false);
  expect(alertasUnidade({ ...base, whatsapp_pedidos: "5511999999999" }, true).semWhatsapp).toBe(
    false,
  );
  expect(
    alertasUnidade({ ...base, situacao: { ...s, aberta_agora: false, motivo: "horario" } }, true)
      .semHorario,
  ).toBe(false);
  const copiada = gradeCopiada({ seg: [["12:00", "15:00"]] });
  expect(copiada.seg).toEqual([["12:00", "15:00"]]);
  expect(copiada.seg).not.toBe(undefined);
  const origem = { seg: [["12:00", "15:00"] as [string, string]] };
  expect(gradeCopiada(origem).seg).not.toBe(origem.seg);
  expect(pendentesDe([{ chave: "a" }, { chave: "b" }], ["a"]).map((i) => i.chave)).toEqual(["b"]);
});
test("G1 fuso da empresa só devolve o fuso; lote não repete chamada e o atendente é recusado", async () => {
  const fuso = await montar("admin", [
    Response.json({ timezone: "America/Manaus", retencao_dias: 90, nome: "Segredo visual" }),
  ]);
  const lido = await executarGestao(fuso.sessao, { acao: "fuso_empresa" });
  expect(lido).toEqual({ ok: true, dados: { timezone: "America/Manaus", origem: "empresa" } });
  expect(JSON.stringify(lido)).not.toContain("retencao");
  expect(JSON.stringify(lido)).not.toContain("Segredo");
  const invalido = await montar("admin", [Response.json({ timezone: "nao-e-fuso" })]);
  expect(await executarGestao(invalido.sessao, { acao: "fuso_empresa" })).toEqual({
    ok: true,
    dados: { timezone: "America/Sao_Paulo", origem: "padrao" },
  });
  const membro = await montar("membro");
  await expect(executarGestao(membro.sessao, { acao: "fuso_empresa" })).rejects.toThrow();
  await expect(
    executarGestao(membro.sessao, { acao: "aplicar_pausas", ids: ["uni"], indefinida: true }),
  ).rejects.toThrow();
  await expect(
    executarGestao(membro.sessao, {
      acao: "aplicar_excecoes",
      itens: [{ id: "uni", data: "2026-12-25", fechado: true }],
    }),
  ).rejects.toThrow();
  expect(membro.chamadas).toHaveLength(0);
  const pausa = await montar("membro");
  const ate = instanteDaqui(30, "America/Sao_Paulo");
  expect(
    (await executarGestao(pausa.sessao, { acao: "pausar", id: "uni", ate, motivo: "pausa rápida" }))
      .ok,
  ).toBe(true);
  expect(pausa.chamadas[0]?.body).toEqual({ ate, motivo: "pausa rápida" });
  const lote = await montar("admin", [
    Response.json({ id: "a" }),
    new Response(
      JSON.stringify({ erro: { codigo: "VALIDATION_ERROR", mensagem: "Recusada", detalhes: {} } }),
      {
        status: 400,
      },
    ),
  ]);
  const primeiro = await executarGestao(lote.sessao, {
    acao: "aplicar_pausas",
    ids: ["a", "b", "a"],
    indefinida: true,
  });
  expect(primeiro.ok && primeiro.dados).toBeTruthy();
  const resultados = (primeiro.ok ? primeiro.dados : {}) as {
    resultados: { chave: string; ok: boolean }[];
  };
  expect(resultados.resultados.map((r) => r.chave)).toEqual(["a", "b"]);
  expect(resultados.resultados.map((r) => r.ok)).toEqual([true, false]);
  expect(lote.chamadas).toHaveLength(2);
  const deNovo = pendentesDe(
    resultados.resultados,
    resultados.resultados.filter((r) => r.ok).map((r) => r.chave),
  );
  expect(deNovo.map((r) => r.chave)).toEqual(["b"]);
  const ex = await montar("admin", [Response.json({ id: 1 }), Response.json({ id: 2 })]);
  const criado = await executarGestao(ex.sessao, {
    acao: "aplicar_excecoes",
    itens: [
      { id: "a", data: "2026-12-25", fechado: true, motivo: "Natal" },
      { id: "b", data: "2026-12-25", fechado: true, motivo: "Natal" },
    ],
  });
  expect(criado.ok).toBe(true);
  expect(ex.chamadas).toHaveLength(2);
  expect(ex.chamadas[0]?.url).toContain("/unidades/a/excecoes");
  expect(ex.chamadas[1]?.url).toContain("/unidades/b/excecoes");
  expect(ex.chamadas[0]?.body).toEqual({ data: "2026-12-25", fechado: true, motivo: "Natal" });
});
