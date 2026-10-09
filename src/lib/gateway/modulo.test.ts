// Executar: bun test src/lib/gateway
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { criarClienteGateway, lerTentarApos, type MetodoGateway } from "./cliente.server";
import { GatewayErro } from "./erros";
import { AcessoNegado, criarModuloGateway, type PerfilGateway } from "./modulo.server";

const CHAVE = "chave-de-teste-nao-usar-0123456789";
const URL_BASE = "http://luxbrain-gateway:8000/admin/v1";

type Chamada = { url: URL; init: RequestInit };

function fetchFalso(respostas: Response[] = []) {
  const chamadas: Chamada[] = [];
  const fn = (async (url: URL, init: RequestInit) => {
    chamadas.push({ url, init });
    return respostas.shift() ?? Response.json({ itens: [] });
  }) as unknown as typeof fetch;
  return { fn, chamadas };
}

const vinculo = (admin: boolean, ativo = true) => [{ gatewayTenantId: "bykoji", ativo, admin }];

const PERFIS: Record<string, PerfilGateway> = {
  plataforma: { userId: "u-p", email: "admin@luxtia.local", superAdmin: true, vinculos: [] },
  adminA: { userId: "u-a", email: "ana@koji.com", superAdmin: false, vinculos: vinculo(true) },
  membroA: { userId: "u-m", email: "beto@koji.com", superAdmin: false, vinculos: vinculo(false) },
  semVinculo: { userId: "u-x", email: "x@luxtia.com", superAdmin: false, vinculos: [] },
  suspenso: {
    userId: "u-s",
    email: "s@koji.com",
    superAdmin: false,
    vinculos: vinculo(true, false),
  },
};

function montar(respostas?: Response[]) {
  const rede = fetchFalso(respostas);
  const bloqueios: { solicitado: string | null; motivo: string }[] = [];
  const modulo = criarModuloGateway({
    cliente: criarClienteGateway({
      url: URL_BASE,
      chave: CHAVE,
      fetch: rede.fn,
      esperar: async () => undefined,
    }),
    carregarPerfil: async ({ userId }) => PERFIS[userId]!,
    registrarBloqueio: async (_perfil, solicitado, motivo) => {
      bloqueios.push({ solicitado, motivo });
    },
  });
  return { modulo, rede, bloqueios };
}

async function tenantDe(papel: string, solicitado?: string) {
  const ctx = montar();
  const sessao = await ctx.modulo.sessao({ userId: papel, email: null });
  return {
    ...ctx,
    t: await sessao.tenant(solicitado ?? (papel === "plataforma" ? "bykoji" : null)),
  };
}

type Op = [MetodoGateway, string[], unknown?];

// Todas as rotas de tenant que o painel usa.
const ROTAS_DO_TENANT: Op[] = [
  ["GET", []],
  ["PATCH", [], { nome: "x" }],
  ["GET", ["config"]],
  ["PUT", ["config"], {}],
  ["GET", ["agentes"]],
  ["POST", ["agentes"], { modelo_id: "m", nome: "n" }],
  ["PATCH", ["agentes", "ag_1"], { fallback: "x" }],
  ["POST", ["agentes", "ag_1", "testar"]],
  ["POST", ["agentes", "ag_1", "simular"], {}],
  ["GET", ["canais"]],
  ["POST", ["canais"], {}],
  ["PATCH", ["canais", "can_1"], { ativo: true }],
  ["POST", ["canais", "can_1", "rotacionar-segredo"]],
  ["GET", ["api-keys"]],
  ["POST", ["api-keys"], {}],
  ["DELETE", ["api-keys", "key_1"]],
  ["GET", ["consumo"]],
  ["GET", ["unidades"]],
  ["POST", ["unidades"], { nome: "Loja" }],
  ["GET", ["conversas"]],
  ["GET", ["conversas", "bykoji:can_1:marco", "mensagens"]],
  ["POST", ["conversas", "bykoji:can_1:marco", "assumir"], { minutos: 60 }],
];

let erros: unknown[][] = [];
const consoleErroOriginal = console.error;
beforeEach(() => {
  erros = [];
  console.error = (...args: unknown[]) => {
    erros.push(args);
  };
});
afterEach(() => {
  console.error = consoleErroOriginal;
});

type Chamavel = {
  chamar: (
    metodo: MetodoGateway,
    partes: string[],
    opcoes: { corpo?: unknown },
  ) => Promise<unknown>;
};

async function recusada(t: Chamavel, [metodo, partes, corpo]: Op) {
  const erro = await t.chamar(metodo, partes, corpo === undefined ? {} : { corpo }).then(
    () => null,
    (e: unknown) => e,
  );
  return erro instanceof AcessoNegado ? erro : null;
}

describe("acesso entre empresas", () => {
  test("usuário da empresa A não acessa o tenant B por nenhuma rota", async () => {
    for (const papel of ["adminA", "membroA"]) {
      const { modulo, rede, bloqueios } = montar();
      const sessao = await modulo.sessao({ userId: papel, email: null });
      for (const [metodo, partes] of ROTAS_DO_TENANT) {
        await expect(
          sessao.tenant("postman_teste").then((t) => t.chamar(metodo, partes)),
        ).rejects.toBeInstanceOf(AcessoNegado);
      }
      expect(rede.chamadas).toHaveLength(0);
      expect(bloqueios.every((b) => b.solicitado === "postman_teste")).toBe(true);
    }
  });

  test("usuário de empresa não usa rotas globais", async () => {
    for (const papel of ["adminA", "membroA"]) {
      const { modulo, rede } = montar();
      const sessao = await modulo.sessao({ userId: papel, email: null });
      await expect(sessao.plataforma()).rejects.toBeInstanceOf(AcessoNegado);
      expect(rede.chamadas).toHaveLength(0);
    }
  });

  test("usuário da empresa A usa o próprio tenant, com ou sem pedir", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "membroA", email: null });
    await (await sessao.tenant()).chamar("GET", ["agentes"]);
    await (await sessao.tenant("bykoji")).chamar("GET", ["agentes"]);
    expect(rede.chamadas.map((c) => c.url.pathname)).toEqual([
      "/admin/v1/tenants/bykoji/agentes",
      "/admin/v1/tenants/bykoji/agentes",
    ]);
  });

  test("usuário sem vínculo é recusado", async () => {
    const { modulo, rede, bloqueios } = montar();
    const sessao = await modulo.sessao({ userId: "semVinculo", email: null });
    await expect(sessao.tenant()).rejects.toBeInstanceOf(AcessoNegado);
    await expect(sessao.tenant("bykoji")).rejects.toBeInstanceOf(AcessoNegado);
    expect(rede.chamadas).toHaveLength(0);
    expect(bloqueios.map((b) => b.solicitado)).toEqual([null, "bykoji"]);
  });

  test("empresa suspensa no painel é recusada", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "suspenso", email: null });
    await expect(sessao.tenant("bykoji")).rejects.toBeInstanceOf(AcessoNegado);
    expect(rede.chamadas).toHaveLength(0);
  });

  test("admin precisa escolher a empresa", async () => {
    const { modulo } = montar();
    const sessao = await modulo.sessao({ userId: "plataforma", email: null });
    await expect(sessao.tenant()).rejects.toBeInstanceOf(AcessoNegado);
  });

  test("tenant com formato inválido é recusado até para o admin", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "plataforma", email: null });
    for (const id of ["bykoji/../x", "../tenants", "BYKOJI", "ab", "bykoji%2fx"]) {
      await expect(sessao.tenant(id)).rejects.toBeInstanceOf(AcessoNegado);
    }
    expect(rede.chamadas).toHaveLength(0);
  });
});

describe("papéis", () => {
  test("admin da plataforma: tudo, inclusive send_mode e skyone_*", async () => {
    const { t, rede, bloqueios } = await tenantDe("plataforma", "postman_teste");
    for (const op of ROTAS_DO_TENANT) expect(await recusada(t, op)).toBeNull();
    const corpo = {
      send_mode: "dry",
      skyone_webhook_url: "https://x.example/f",
      provedor: "skyone",
    };
    expect(await recusada(t, ["PATCH", ["agentes", "ag_1"], corpo])).toBeNull();
    expect(rede.chamadas).toHaveLength(ROTAS_DO_TENANT.length + 1);
    expect(rede.chamadas.at(-1)!.init.body).toBe(JSON.stringify(corpo));
    expect(bloqueios).toHaveLength(0);
  });

  test("admin da empresa não altera send_mode nem skyone_webhook_url", async () => {
    const { t, rede, bloqueios } = await tenantDe("adminA");
    for (const corpo of [
      { send_mode: "live" },
      { skyone_webhook_url: "https://x.example/f" },
      { fallback: "ok", send_mode: "dry" },
    ]) {
      const erro = await recusada(t, ["PATCH", ["agentes", "ag_1"], corpo]);
      expect(erro).not.toBeNull();
      expect(erro!.message).toContain(Object.keys(corpo).at(-1)!);
      expect(erro!.message).toContain("Campos permitidos");
    }
    expect(rede.chamadas).toHaveLength(0);
    expect(bloqueios).toHaveLength(3);
  });

  test("admin da empresa: demais campos e ações proibidos", async () => {
    const { t, rede } = await tenantDe("adminA");
    const proibidas: Op[] = [
      ["PATCH", ["agentes", "ag_1"], { provedor: "skyone" }],
      ["PATCH", ["agentes", "ag_1"], { agente_mode: "live" }],
      ["PATCH", ["agentes", "ag_1"], { timeout_s: 30 }],
      ["PATCH", ["agentes", "ag_1"], { instrucoes_agente: "x" }],
      ["PATCH", ["agentes", "ag_1"], { skyone_auth: "x", skyone_auth_usuario: "y" }],
      ["PATCH", ["agentes", "ag_1"], { nome: "Outro" }],
      ["PATCH", ["agentes", "ag_1"], { status: "rascunho" }],
      ["PATCH", ["agentes", "ag_1"], null],
      ["POST", ["agentes", "ag_1", "testar"], { usar_provedor_real: true }],
      ["POST", ["agentes"], { modelo_id: "m", nome: "n" }],
      ["POST", ["canais"], { tipo: "api" }],
      ["PATCH", ["canais", "can_1"], { ativo: true }],
      ["POST", ["canais", "can_1", "rotacionar-segredo"]],
      ["GET", ["api-keys"]],
      ["POST", ["api-keys"], { nome: "k" }],
      ["DELETE", ["api-keys", "key_1"]],
      ["GET", []],
      ["PATCH", [], { status: "suspenso" }],
      ["PUT", ["config"], { send_mode: "live" }],
      ["GET", ["contatos"]],
      ["GET", ["webhooks-saida"]],
    ];
    for (const op of proibidas) {
      expect({ op, recusada: Boolean(await recusada(t, op)) }).toEqual({ op, recusada: true });
    }
    expect(rede.chamadas).toHaveLength(0);
  });

  test("admin da empresa: campos permitidos, unidades, testar, simular, canais, consumo e conversas", async () => {
    const { t, rede } = await tenantDe("adminA");
    const permitidas: Op[] = [
      [
        "PATCH",
        ["agentes", "ag_1"],
        {
          aviso_demora: "Um instante",
          fallback: "Tente de novo",
          modo_piloto: true,
          contatos_permitidos: ["5511999999999"],
          debounce_s: 4,
          max_wait_s: 12,
          pause_minutes: 60,
          slow_notice_s: 15,
          alerta_telefone: "5511988887777",
          status: "pausado",
        },
      ],
      ["PATCH", ["agentes", "ag_1"], { status: "ativo" }],
      ["GET", ["agentes"]],
      ["GET", ["agentes", "ag_1"]],
      ["POST", ["agentes", "ag_1", "testar"]],
      [
        "POST",
        ["agentes", "ag_1", "simular"],
        { canal_id: "can_1", identificador: "a", texto: "oi" },
      ],
      ["GET", ["canais"]],
      ["GET", ["canais", "can_1"]],
      ["GET", ["consumo"]],
      ["GET", ["unidades"]],
      ["POST", ["unidades"], { nome: "Loja" }],
      ["GET", ["unidades", "uni_1"]],
      ["PATCH", ["unidades", "uni_1"], { horarios: { seg: [["11:00", "15:00"]] } }],
      ["DELETE", ["unidades", "uni_1"]],
      ["GET", ["conversas"]],
      ["GET", ["conversas", "c", "mensagens"]],
      ["POST", ["conversas", "c", "assumir"]],
      ["POST", ["conversas", "c", "devolver"]],
      ["POST", ["conversas", "c", "mensagens"], { texto: "Olá" }],
      ["GET", ["eventos"]],
    ];
    for (const op of permitidas) {
      expect({ op, recusada: Boolean(await recusada(t, op)) }).toEqual({ op, recusada: false });
    }
    expect(rede.chamadas).toHaveLength(permitidas.length);
  });

  test("membro não faz PATCH em agente, nem testar, simular ou unidades", async () => {
    const { t, rede } = await tenantDe("membroA");
    const proibidas: Op[] = [
      ["PATCH", ["agentes", "ag_1"], { fallback: "x" }],
      ["PATCH", ["agentes", "ag_1"], { status: "pausado" }],
      ["POST", ["agentes", "ag_1", "testar"]],
      ["POST", ["agentes", "ag_1", "simular"], {}],
      ["GET", ["unidades"]],
      ["POST", ["unidades"], { nome: "Loja" }],
      ["POST", ["canais"], {}],
      ["GET", ["api-keys"]],
    ];
    for (const op of proibidas) {
      expect({ op, recusada: Boolean(await recusada(t, op)) }).toEqual({ op, recusada: true });
    }
    expect(rede.chamadas).toHaveLength(0);
  });

  test("membro lê agentes, canais e consumo e atende conversas", async () => {
    const { t, rede } = await tenantDe("membroA");
    const permitidas: Op[] = [
      ["GET", ["agentes"]],
      ["GET", ["agentes", "ag_1"]],
      ["GET", ["agentes", "ag_1", "circuito"]],
      ["GET", ["canais"]],
      ["GET", ["consumo"]],
      ["GET", ["conversas"]],
      ["GET", ["conversas", "c", "mensagens"]],
      ["POST", ["conversas", "c", "assumir"], { minutos: 30 }],
      ["POST", ["conversas", "c", "devolver"]],
      ["POST", ["conversas", "c", "mensagens"], { texto: "Olá" }],
    ];
    for (const op of permitidas) {
      expect({ op, recusada: Boolean(await recusada(t, op)) }).toEqual({ op, recusada: false });
    }
    expect(rede.chamadas).toHaveLength(permitidas.length);
  });
});

describe("cliente HTTP", () => {
  test("envia Bearer, X-Actor do usuário logado e codifica segmentos", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "plataforma", email: null });
    await (
      await sessao.tenant("bykoji")
    ).chamar("GET", ["conversas", "bykoji:can_1:a/b", "mensagens"]);
    const { url, init } = rede.chamadas[0]!;
    const cab = init.headers as Record<string, string>;
    expect(cab["Authorization"]).toBe(`Bearer ${CHAVE}`);
    expect(cab["X-Actor"]).toBe("admin@luxtia.local");
    expect(url.pathname).toBe(
      "/admin/v1/tenants/bykoji/conversas/bykoji%3Acan_1%3Aa%2Fb/mensagens",
    );
  });

  test("interpreta o envelope {erro}", async () => {
    const { modulo } = montar([
      Response.json(
        {
          erro: { codigo: "CONFLICT", mensagem: "A operação conflita.", detalhes: { campo: "id" } },
        },
        { status: 409 },
      ),
    ]);
    const t = await (await modulo.sessao({ userId: "plataforma", email: null })).tenant("bykoji");
    const erro = (await t.chamar("GET").catch((e) => e)) as GatewayErro;
    expect(erro).toBeInstanceOf(GatewayErro);
    expect(erro.codigo).toBe("CONFLICT");
    expect(erro.message).toBe("A operação conflita.");
    expect(erro.detalhes).toEqual({ campo: "id" });
  });

  test("código fora da tabela e mensagem igual ao código viram texto padrão", async () => {
    const { modulo } = montar([
      Response.json(
        { erro: { codigo: "TENANT_NOT_FOUND", mensagem: "TENANT_NOT_FOUND", detalhes: {} } },
        { status: 404 },
      ),
    ]);
    const t = await (await modulo.sessao({ userId: "plataforma", email: null })).tenant("bykoji");
    const erro = (await t.chamar("GET").catch((e) => e)) as GatewayErro;
    expect(erro.codigo).toBe("NOT_FOUND");
    expect(erro.message).toBe("Recurso não encontrado.");
  });

  test("interpreta {detail} sem repassar o texto do servidor", async () => {
    const { modulo } = montar([
      Response.json({ detail: "Not Found: segredo interno" }, { status: 404 }),
      Response.json({ detail: [{ loc: ["body", "nome"], msg: "x" }] }, { status: 422 }),
    ]);
    const t = await (await modulo.sessao({ userId: "plataforma", email: null })).tenant("bykoji");
    const e404 = (await t.chamar("GET").catch((e) => e)) as GatewayErro;
    expect(e404.codigo).toBe("NOT_FOUND");
    expect(e404.message).not.toContain("segredo");
    const e422 = (await t.chamar("POST").catch((e) => e)) as GatewayErro;
    expect(e422.codigo).toBe("VALIDATION_ERROR");
    expect(e422.detalhes).toEqual({ campo: "nome" });
  });

  test("429 com Retry-After curto espera e repete uma vez", async () => {
    const esperas: number[] = [];
    const rede = fetchFalso([
      new Response("{}", { status: 429, headers: { "Retry-After": "2" } }),
      Response.json({ ok: true }),
    ]);
    const cliente = criarClienteGateway({
      url: URL_BASE,
      chave: CHAVE,
      fetch: rede.fn,
      esperar: async (ms) => {
        esperas.push(ms);
      },
    });
    const r = await cliente.requisitar({ metodo: "GET", caminho: ["tenants"], ator: "a" });
    expect(r.dados).toEqual({ ok: true });
    expect(esperas).toEqual([2000]);
    expect(rede.chamadas).toHaveLength(2);
  });

  test("429 com Retry-After longo devolve RATE_LIMITED com a espera", async () => {
    const rede = fetchFalso([
      Response.json(
        { erro: { codigo: "RATE_LIMITED", mensagem: "Limite.", detalhes: {} } },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    ]);
    const cliente = criarClienteGateway({ url: URL_BASE, chave: CHAVE, fetch: rede.fn });
    const erro = (await cliente
      .requisitar({ metodo: "GET", caminho: ["tenants"], ator: "a" })
      .catch((e) => e)) as GatewayErro;
    expect(erro.codigo).toBe("RATE_LIMITED");
    expect(erro.tentarApos).toBe(30);
    expect(rede.chamadas).toHaveLength(1);
  });

  test("Retry-After em data HTTP", () => {
    const agora = Date.parse("2026-10-09T12:00:00Z");
    expect(lerTentarApos("Fri, 09 Oct 2026 12:00:10 GMT", agora)).toBe(10);
    expect(lerTentarApos(null)).toBeNull();
  });

  test("a chave nunca aparece em erro nem em log", async () => {
    const quebrado = (async () => {
      throw new Error(`falha com ${CHAVE}`);
    }) as unknown as typeof fetch;
    const clientes = [
      criarClienteGateway({ url: URL_BASE, chave: CHAVE, fetch: quebrado }),
      criarClienteGateway({
        url: URL_BASE,
        chave: CHAVE,
        fetch: fetchFalso([
          new Response("erro", { status: 500 }),
          new Response("", { status: 401 }),
        ]).fn,
      }),
    ];
    const falhas: unknown[] = [];
    for (const cliente of clientes) {
      for (let i = 0; i < 2; i += 1) {
        falhas.push(
          await cliente
            .requisitar({ metodo: "GET", caminho: ["tenants"], ator: "a" })
            .catch((e) => e),
        );
      }
    }
    const texto = JSON.stringify([falhas.map((f) => String(f)), erros.map((e) => e.map(String))]);
    expect(erros.length).toBeGreaterThan(0);
    expect(texto).not.toContain(CHAVE);
  });
});
