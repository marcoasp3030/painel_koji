// Executar: bun test src/lib/gateway
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { criarClienteGateway, lerTentarApos } from "./cliente.server";
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

const PERFIS: Record<string, PerfilGateway> = {
  admin: { userId: "u-admin", email: "admin@luxtia.local", superAdmin: true, vinculos: [] },
  empresaA: {
    userId: "u-a",
    email: "ana@koji.com",
    superAdmin: false,
    vinculos: [{ gatewayTenantId: "bykoji", ativo: true }],
  },
  semVinculo: { userId: "u-x", email: "x@luxtia.com", superAdmin: false, vinculos: [] },
  suspenso: {
    userId: "u-s",
    email: "s@koji.com",
    superAdmin: false,
    vinculos: [{ gatewayTenantId: "bykoji", ativo: false }],
  },
};

function montar(respostas?: Response[]) {
  const rede = fetchFalso(respostas);
  const bloqueios: (string | null)[] = [];
  const modulo = criarModuloGateway({
    cliente: criarClienteGateway({
      url: URL_BASE,
      chave: CHAVE,
      fetch: rede.fn,
      esperar: async () => undefined,
    }),
    carregarPerfil: async ({ userId }) => PERFIS[userId]!,
    registrarBloqueio: async (_perfil, solicitado) => {
      bloqueios.push(solicitado);
    },
  });
  return { modulo, rede, bloqueios };
}

// Todas as rotas de tenant que o painel usa nas telas desta integração.
const ROTAS_DO_TENANT: [string, string[]][] = [
  ["GET", []],
  ["PATCH", []],
  ["GET", ["config"]],
  ["PUT", ["config"]],
  ["GET", ["agentes"]],
  ["POST", ["agentes"]],
  ["PATCH", ["agentes", "ag_1"]],
  ["POST", ["agentes", "ag_1", "testar"]],
  ["POST", ["agentes", "ag_1", "simular"]],
  ["GET", ["canais"]],
  ["POST", ["canais"]],
  ["POST", ["canais", "can_1", "rotacionar-segredo"]],
  ["GET", ["api-keys"]],
  ["POST", ["api-keys"]],
  ["DELETE", ["api-keys", "key_1"]],
  ["GET", ["conversas", "bykoji:can_1:marco", "mensagens"]],
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

describe("acesso entre empresas", () => {
  test("usuário da empresa A não acessa o tenant B por nenhuma rota", async () => {
    const { modulo, rede, bloqueios } = montar();
    const sessao = await modulo.sessao({ userId: "empresaA", email: null });
    for (const [, partes] of ROTAS_DO_TENANT) {
      await expect(
        sessao.tenant("postman_teste").then((t) => t.chamar("GET", partes)),
      ).rejects.toBeInstanceOf(AcessoNegado);
    }
    expect(rede.chamadas).toHaveLength(0);
    expect(bloqueios.every((b) => b === "postman_teste")).toBe(true);
  });

  test("usuário da empresa A não usa rotas globais nem troca o tenant da query", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "empresaA", email: null });
    await expect(sessao.plataforma()).rejects.toBeInstanceOf(AcessoNegado);

    const tenant = await sessao.tenant();
    await tenant.lerGlobal(["modelos-agente"], { query: { tenant: "postman_teste" } });
    expect(rede.chamadas[0]!.url.searchParams.get("tenant")).toBe("bykoji");
    expect(() => tenant.lerGlobal(["tenants"])).toThrow(AcessoNegado);
  });

  test("usuário da empresa A usa o próprio tenant, com ou sem pedir", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "empresaA", email: null });
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
    expect(bloqueios).toEqual([null, "bykoji"]);
  });

  test("empresa suspensa no painel é recusada", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "suspenso", email: null });
    await expect(sessao.tenant("bykoji")).rejects.toBeInstanceOf(AcessoNegado);
    expect(rede.chamadas).toHaveLength(0);
  });

  test("admin da plataforma acessa qualquer tenant e as rotas globais", async () => {
    const { modulo, rede, bloqueios } = montar();
    const sessao = await modulo.sessao({ userId: "admin", email: null });
    for (const [metodo, partes] of ROTAS_DO_TENANT) {
      const t = await sessao.tenant("postman_teste");
      await t.chamar(metodo as "GET", partes);
    }
    await (await sessao.plataforma()).chamar("GET", ["tenants"]);
    expect(rede.chamadas).toHaveLength(ROTAS_DO_TENANT.length + 1);
    expect(rede.chamadas[0]!.url.pathname).toBe("/admin/v1/tenants/postman_teste");
    expect(bloqueios).toHaveLength(0);
  });

  test("admin precisa escolher a empresa", async () => {
    const { modulo } = montar();
    const sessao = await modulo.sessao({ userId: "admin", email: null });
    await expect(sessao.tenant()).rejects.toBeInstanceOf(AcessoNegado);
  });

  test("tenant com formato inválido é recusado até para o admin", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "admin", email: null });
    for (const id of ["bykoji/../x", "../tenants", "BYKOJI", "ab", "bykoji%2fx"]) {
      await expect(sessao.tenant(id)).rejects.toBeInstanceOf(AcessoNegado);
    }
    expect(rede.chamadas).toHaveLength(0);
  });
});

describe("cliente HTTP", () => {
  test("envia Bearer, X-Actor do usuário logado e codifica segmentos", async () => {
    const { modulo, rede } = montar();
    const sessao = await modulo.sessao({ userId: "admin", email: null });
    await (await sessao.tenant("bykoji")).chamar("GET", ["conversas", "bykoji:can_1:a/b", "mensagens"]);
    const { url, init } = rede.chamadas[0]!;
    const cab = init.headers as Record<string, string>;
    expect(cab["Authorization"]).toBe(`Bearer ${CHAVE}`);
    expect(cab["X-Actor"]).toBe("admin@luxtia.local");
    expect(url.pathname).toBe("/admin/v1/tenants/bykoji/conversas/bykoji%3Acan_1%3Aa%2Fb/mensagens");
  });

  test("interpreta o envelope {erro}", async () => {
    const { modulo } = montar([
      Response.json(
        { erro: { codigo: "CONFLICT", mensagem: "A operação conflita.", detalhes: { campo: "id" } } },
        { status: 409 },
      ),
    ]);
    const t = await (await modulo.sessao({ userId: "admin", email: null })).tenant("bykoji");
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
    const t = await (await modulo.sessao({ userId: "admin", email: null })).tenant("bykoji");
    const erro = (await t.chamar("GET").catch((e) => e)) as GatewayErro;
    expect(erro.codigo).toBe("NOT_FOUND");
    expect(erro.message).toBe("Recurso não encontrado.");
  });

  test("interpreta {detail} sem repassar o texto do servidor", async () => {
    const { modulo } = montar([
      Response.json({ detail: "Not Found: segredo interno" }, { status: 404 }),
      Response.json({ detail: [{ loc: ["body", "nome"], msg: "x" }] }, { status: 422 }),
    ]);
    const t = await (await modulo.sessao({ userId: "admin", email: null })).tenant("bykoji");
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
        fetch: fetchFalso([new Response("erro", { status: 500 }), new Response("", { status: 401 })]).fn,
      }),
    ];
    const falhas: unknown[] = [];
    for (const cliente of clientes) {
      for (let i = 0; i < 2; i += 1) {
        falhas.push(
          await cliente.requisitar({ metodo: "GET", caminho: ["tenants"], ator: "a" }).catch((e) => e),
        );
      }
    }
    const texto = JSON.stringify([falhas.map((f) => String(f)), erros.map((e) => e.map(String))]);
    expect(erros.length).toBeGreaterThan(0);
    expect(texto).not.toContain(CHAVE);
  });
});
