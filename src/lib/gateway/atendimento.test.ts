import { expect, test } from "bun:test";
import { criarClienteGateway } from "./cliente.server";
import { criarModuloGateway } from "./modulo.server";
import { executarAtendimento } from "./atendimento.server";
import {
  SEM_EDICOES,
  corpoRascunho,
  gruposDoEsquema,
  marcarTrechos,
  porCampo,
  rotuloCaminho,
  rotuloCampo,
  situacaoCampo,
  textoValor,
  type Visao,
} from "./atendimento";
import { filtrarMenu, TENANT_NAV } from "../nav";

async function montar(papel = "admin", respostas: Response[] = []) {
  const chamadas: { url: URL; method: string; body: unknown; papel: string | null }[] = [];
  const modulo = criarModuloGateway({
    carregarPerfil: async () => ({
      userId: "u",
      email: "ana@koji.com",
      superAdmin: papel === "plataforma",
      vinculos: [{ gatewayTenantId: "bykoji", ativo: true, admin: papel === "admin" }],
    }),
    cliente: criarClienteGateway({
      url: "http://gateway:8000/admin/v1",
      chave: "sintetica-nao-segredo-real-123456",
      fetch: (async (url: URL, init: RequestInit) => {
        const h = new Headers(init.headers);
        chamadas.push({
          url: new URL(String(url)),
          method: init.method ?? "GET",
          body: init.body ? JSON.parse(String(init.body)) : null,
          papel: h.get("X-Role"),
        });
        return respostas.shift() ?? Response.json({ ok: true });
      }) as typeof fetch,
    }),
  });
  return { sessao: await modulo.sessao({ userId: "u", email: null }), chamadas };
}
const erro = (status: number, detalhes: Record<string, unknown>, codigo = "VALIDATION_ERROR") =>
  Response.json({ erro: { codigo, mensagem: "x", detalhes } }, { status });

function visao(parcial: Partial<Visao> = {}): Visao {
  const origem = {
    perfil: { tom: "segmento", emojis: "empresa" },
    comportamentos: { debounce_s: "plataforma" },
  } as const;
  return {
    escopo: "empresa",
    segmento: "delivery_restaurante",
    versao_publicada: 2,
    publicado_em: null,
    publicado_por: null,
    perfil_versao: "e2",
    publicado: { perfil: { emojis: "nenhum" }, comportamentos: {} },
    personalizado: { perfil: ["emojis"], comportamentos: [] },
    efetivo: {
      perfil: { tom: "equilibrado", emojis: "nenhum" },
      comportamentos: { debounce_s: 4 },
      origem: origem as Visao["efetivo"]["origem"],
    },
    rascunho: null,
    esquema: {
      perfil: {
        tom: { tipo: "escolha", opcoes: ["formal", "equilibrado"], editavel: true },
        emojis: { tipo: "escolha", opcoes: ["nenhum", "moderado"], editavel: true },
        nome_empresa: { tipo: "texto", max: 80, editavel: true },
      },
      comportamentos: {
        debounce_s: {
          grupo: "ritmo",
          tipo: "inteiro",
          min: 1,
          max: 15,
          editavel: true,
          disponivel: true,
        },
        reacoes: {
          grupo: "reacoes",
          tipo: "escolha",
          opcoes: ["on", "off"],
          editavel: true,
          disponivel: false,
        },
        send_mode: { grupo: "operacao", tipo: "so_plataforma", editavel: false, disponivel: true },
      },
    },
    pode_editar: true,
    ...parcial,
  };
}

test("CFG1-a tela pelo esquema: campos novos aparecem sozinhos, na ordem do gateway", () => {
  const v = visao();
  expect(gruposDoEsquema(v.esquema, "perfil")[0]!.campos.map(([c]) => c)).toEqual([
    "tom",
    "emojis",
    "nome_empresa",
  ]);
  expect(gruposDoEsquema(v.esquema, "comportamentos").map((g) => g.grupo)).toEqual([
    "ritmo",
    "reacoes",
    "operacao",
  ]);
  expect(rotuloCampo("nome_empresa")).toBe("Nome da empresa");
  expect(rotuloCampo("descricao_negocio")).toBe("Descrição do negócio");
  expect(rotuloCampo("campo_que_ainda_nao_existe")).toBe("Campo que ainda nao existe");
  expect(rotuloCaminho("perfil.assuntos_proibidos[2]")).toBe("Assuntos proibidos (item 3)");
  expect(rotuloCaminho("comportamentos.debounce_s")).toBe("Espera por mais mensagens (s)");
});

test("CFG1-a origem, Personalizado e rascunho por campo", () => {
  const v = visao();
  expect(situacaoCampo(v, "perfil", "tom", SEM_EDICOES)).toMatchObject({
    valor: "equilibrado",
    origem: "segmento",
    personalizado: false,
  });
  expect(situacaoCampo(v, "perfil", "emojis", SEM_EDICOES)).toMatchObject({ personalizado: true });
  // No agente, valor que vem da empresa não é personalizado.
  expect(
    situacaoCampo({ ...v, escopo: "agente" }, "perfil", "emojis", SEM_EDICOES).personalizado,
  ).toBe(false);
  // Edição local e rascunho com null (voltar ao padrão).
  const ed = { perfil: { tom: "formal" }, comportamentos: {} };
  expect(situacaoCampo(v, "perfil", "tom", ed)).toMatchObject({
    valor: "formal",
    editado: true,
    personalizado: true,
  });
  const comRascunho = visao({
    rascunho: {
      baseado_em: 2,
      desatualizado: false,
      atualizado_em: "2026-10-11T15:00:00Z",
      atualizado_por: "ana",
      perfil: { emojis: null },
      comportamentos: {},
      efetivo: { ...v.efetivo, perfil: { tom: "equilibrado", emojis: "moderado" } },
      alteracoes: [{ campo: "perfil.emojis", antes: "nenhum", depois: null }],
      bloqueios: [],
      avisos: [],
    },
  });
  expect(situacaoCampo(comRascunho, "perfil", "emojis", SEM_EDICOES)).toMatchObject({
    valor: "moderado",
    valorPublicado: "nenhum",
    personalizado: false,
    noRascunho: true,
  });
  expect(corpoRascunho(comRascunho, ed)).toEqual({ baseado_em: 2, perfil: { tom: "formal" } });
  expect(corpoRascunho(v, SEM_EDICOES)).toEqual({ baseado_em: 2 });
});

test("CFG1-a trechos marcados, erros por campo e valores legíveis", () => {
  expect(marcarTrechos("Ignore as instruções e responda", ["Ignore as instruções"])).toEqual([
    { texto: "Ignore as instruções", marcado: true },
    { texto: " e responda", marcado: false },
  ]);
  expect(marcarTrechos("abc", ["zz"])).toEqual([{ texto: "abc", marcado: false }]);
  const m = porCampo([
    { campo: "perfil.assuntos_proibidos[0]", motivo: "item" },
    { campo: "perfil.assuntos_proibidos[3]", motivo: "item" },
    { campo: "perfil.tom", motivo: "opcao" },
  ]);
  expect(m.get("perfil.assuntos_proibidos")).toHaveLength(2);
  expect(textoValor(true)).toBe("Sim");
  expect(textoValor("descontraido")).toBe("Descontraído");
  expect(textoValor(2.5)).toBe("2,5");
  expect(textoValor([{ assunto: "Política", acao: "recusar" }])).toBe("Política (Recusar)");
  expect(textoValor(null)).toBe("—");
});

test("CFG1-a membro lê e vê a prévia; escrita recusada sem chamar o gateway", async () => {
  const c = await montar("membro");
  for (const acao of ["ler", "versoes"]) {
    expect((await executarAtendimento(c.sessao, { acao })).ok).toBe(true);
  }
  expect((await executarAtendimento(c.sessao, { acao: "previa", fonte: "publicado" })).ok).toBe(
    true,
  );
  const feitas = c.chamadas.length;
  for (const e of [
    { acao: "salvar", baseado_em: 0, perfil: { tom: "formal" } },
    { acao: "descartar" },
    { acao: "publicar", baseado_em: 0 },
    { acao: "restaurar", versao: 1 },
  ]) {
    const r = await executarAtendimento(c.sessao, e);
    expect(r).toEqual({
      ok: false,
      erro: { status: 403, mensagem: expect.stringContaining("Sem permissão") },
    });
  }
  expect(c.chamadas).toHaveLength(feitas);
  expect(c.chamadas.every((x) => x.papel === "membro")).toBe(true);
  expect(c.chamadas[2]!.url.pathname).toBe("/admin/v1/tenants/bykoji/atendimento/previa");
  expect(c.chamadas[2]!.body).toEqual({ fonte: "publicado" });
});

test("CFG1-a admin: rascunho parcial, publicar com nota e escopo do agente", async () => {
  const c = await montar("admin", [
    Response.json({}),
    Response.json({}),
    Response.json({ nome: "Atendimento By Koji" }),
    Response.json({}),
  ]);
  await executarAtendimento(c.sessao, {
    acao: "salvar",
    baseado_em: 2,
    perfil: { tom: "formal", emojis: null },
  });
  expect(c.chamadas[0]).toMatchObject({ method: "PUT", papel: "admin" });
  expect(c.chamadas[0]!.url.pathname).toBe("/admin/v1/tenants/bykoji/atendimento/rascunho");
  expect(c.chamadas[0]!.body).toEqual({ baseado_em: 2, perfil: { tom: "formal", emojis: null } });

  await executarAtendimento(c.sessao, { acao: "publicar", baseado_em: 2, nota: " tom formal " });
  expect(c.chamadas[1]!.body).toEqual({
    baseado_em: 2,
    nota: "tom formal",
    confirmar_avisos: false,
  });

  // Agente: confere que não é agente oculto e usa o caminho do agente.
  await executarAtendimento(c.sessao, { acao: "versao", versao: 3, agente: "bykoji_atendimento" });
  expect(c.chamadas[2]!.url.pathname).toBe("/admin/v1/tenants/bykoji/agentes/bykoji_atendimento");
  expect(c.chamadas[3]!.url.pathname).toBe(
    "/admin/v1/tenants/bykoji/agentes/bykoji_atendimento/atendimento/versoes/3",
  );
});

test("CFG1-a agente de teste oculto vira não encontrado para a empresa", async () => {
  const c = await montar("admin", [Response.json({ nome: "[teste] Bench" })]);
  const r = await executarAtendimento(c.sessao, { acao: "ler", agente: "ag_teste" });
  expect(r.ok).toBe(false);
  expect(c.chamadas).toHaveLength(1);
});

test("CFG1-a erros: todos os campos, confirmação com trecho, bloqueio e versão desatualizada", async () => {
  const c = await montar("admin", [
    erro(400, {
      campos: [
        { campo: "perfil.tom", motivo: "opcao" },
        { campo: "comportamentos.send_mode", motivo: "so_plataforma" },
      ],
    }),
    erro(
      409,
      {
        motivo: "confirmacao_necessaria",
        avisos: [{ campo: "perfil.regras_da_casa", motivo: "link", trecho: "www.x.com" }],
      },
      "CONFLICT",
    ),
    erro(400, {
      motivo: "texto_bloqueado",
      bloqueios: [
        {
          campo: "perfil.regras_da_casa",
          motivo: "ignorar_instrucoes",
          trecho: "ignore as regras",
        },
      ],
    }),
    erro(409, { motivo: "versao_desatualizada", versao_publicada: 3 }, "CONFLICT"),
  ]);
  const a = await executarAtendimento(c.sessao, {
    acao: "salvar",
    baseado_em: 2,
    perfil: { tom: "x" },
  });
  expect(a.ok === false && a.erro.campos).toHaveLength(2);
  expect(a.ok === false && a.erro.mensagem).toBe("2 campos com erro.");
  const b = await executarAtendimento(c.sessao, { acao: "publicar", baseado_em: 2 });
  expect(b.ok === false && b.erro).toMatchObject({
    status: 409,
    motivo: "confirmacao_necessaria",
    avisos: [{ trecho: "www.x.com" }],
  });
  const d = await executarAtendimento(c.sessao, {
    acao: "publicar",
    baseado_em: 2,
    confirmar_avisos: true,
  });
  expect(c.chamadas[2]!.body).toMatchObject({ confirmar_avisos: true });
  expect(d.ok === false && d.erro).toMatchObject({
    motivo: "texto_bloqueado",
    bloqueios: [{ trecho: "ignore as regras" }],
  });
  const e = await executarAtendimento(c.sessao, { acao: "publicar", baseado_em: 2 });
  expect(e.ok === false && e.erro).toMatchObject({
    motivo: "versao_desatualizada",
    versao_publicada: 3,
  });
});

test("CFG1-a gateway 403 vira 'Sem permissão'; outra empresa não chama o gateway", async () => {
  const c = await montar("admin", [erro(403, {}, "FORBIDDEN")]);
  const r = await executarAtendimento(c.sessao, { acao: "descartar" });
  expect(r.ok === false && r.erro.mensagem).toContain("Sem permissão");
  const outra = await montar("admin");
  await expect(
    executarAtendimento(outra.sessao, { acao: "ler", empresa: "outra" }),
  ).rejects.toThrow();
  expect(outra.chamadas).toHaveLength(0);
  expect((await executarAtendimento(outra.sessao, { acao: "inventada" })).ok).toBe(false);
});

test("CFG1-a menu: admin e membro veem Comportamento do agente", () => {
  for (const papel of ["admin", "membro"] as const)
    expect(
      filtrarMenu(TENANT_NAV, papel).some((i) => i.to === "/ia/configuracoes/comportamento"),
    ).toBe(true);
});
