import { expect, test } from "bun:test";
import { criarClienteGateway } from "./cliente.server";
import { criarModuloGateway, type PapelGateway } from "./modulo.server";
import { executarAvisos } from "./avisos.server";
import { filtrarMenu, TENANT_NAV } from "../nav";
async function montar(papel: PapelGateway = "gestor", respostas: Response[] = []) {
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
      chavePlataforma: "chave-plataforma-sintetica",
      fetch: (async (url: URL, init: RequestInit) => {
        const h = new Headers(init.headers);
        chamadas.push({
          url: String(url),
          role: h.get("X-Role"),
          actor: h.get("X-Actor"),
          method: init.method,
          body: init.body ? JSON.parse(String(init.body)) : null,
        });
        return respostas.shift() ?? Response.json({ itens: [] });
      }) as typeof fetch,
    }),
  });
  return { sessao: await modulo.sessao({ userId: "u", email: "forjado@teste.com" }), chamadas };
}
test("PED1-b X-Role e X-Actor vêm do perfil em GET/escrita e chamadas globais", async () => {
  for (const papel of ["funcionario", "gestor", "plataforma"] as const) {
    const c = await montar(papel);
    const t = await c.sessao.tenant("teste");
    await t.chamar("GET", ["pedidos", "contagem"]);
    if (papel !== "funcionario")
      await t.chamar("POST", ["pedidos", "123", "avisos", "confirmado", "reenviar"]);
    expect(c.chamadas.every((x) => x.role === papel && x.actor === "sessao@teste.com")).toBe(true);
    if (papel === "plataforma") {
      const p = await c.sessao.plataforma();
      await p.chamar("GET", ["tenants"]);
      expect(c.chamadas.at(-1)?.role).toBe("plataforma");
    }
  }
});
test("PED1-b membro não altera textos: erro 403 claro, sem chamada; menu oculto", async () => {
  const c = await montar("funcionario");
  const r = await executarAvisos(c.sessao, {
    acao: "salvar",
    status: "confirmado",
    modalidade: "delivery",
    texto: "Pedido {numero}",
  });
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.erro.status).toBe(403);
    expect(r.erro.mensagem).toContain("supervisor");
  }
  expect(c.chamadas).toHaveLength(0);
  const t = await c.sessao.tenant();
  await expect(
    t.chamar("PUT", ["pedidos", "avisos", "confirmado"], { corpo: { texto: "teste" } }),
  ).rejects.toThrow();
  expect(filtrarMenu(TENANT_NAV, "funcionario").some((i) => i.to.includes("configuracoes/avisos"))).toBe(
    false,
  );
});
test("PED1-b isolamento e rejeição de actor/role forjados", async () => {
  const c = await montar();
  for (const entrada of [
    { acao: "ler", empresa: "outra" },
    { acao: "ler", actor: "admin" },
    { acao: "ler", papel: "plataforma" },
    { acao: "ler", role: "plataforma" },
  ])
    expect((await executarAvisos(c.sessao, entrada)).ok).toBe(false);
  expect(c.chamadas).toHaveLength(0);
});
test("PED1-b configuração por modalidade, null restaura, prévia passa sintaxe intacta", async () => {
  const c = await montar();
  await executarAvisos(c.sessao, {
    acao: "salvar",
    status: "concluido",
    modalidade: "retirada",
    texto: null,
    ativo: null,
  });
  expect(c.chamadas[0]?.body).toEqual({ modalidade: "retirada", texto: null, ativo: null });
  expect(c.chamadas[0]?.method).toBe("PUT");
  await executarAvisos(c.sessao, {
    acao: "previa",
    status: "confirmado",
    modalidade: "delivery",
    texto: "Pedido {numero}[[ em {previsao}]]",
  });
  expect(c.chamadas[1]?.url).toEndWith("/pedidos/avisos/confirmado/previa");
  expect(c.chamadas[1]?.body).toEqual({
    modalidade: "delivery",
    texto: "Pedido {numero}[[ em {previsao}]]",
  });
});
test("PED1-b 400 de texto e 403 do gateway chegam ao formulário", async () => {
  for (const status of [400, 403]) {
    const c = await montar("gestor", [
      Response.json(
        {
          erro: {
            codigo: status === 400 ? "VALIDATION_ERROR" : "FORBIDDEN",
            mensagem: "Texto inválido",
            detalhes: { campo: "texto", motivo: "formato" },
          },
        },
        { status },
      ),
    ]);
    const r = await executarAvisos(c.sessao, {
      acao: "salvar",
      status: "confirmado",
      modalidade: "delivery",
      texto: "[[ trecho",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro.status).toBe(status);
      expect(r.erro.campo).toBe("texto");
      if (status === 403) expect(r.erro.mensagem).toContain("administradores");
    }
  }
});
test("PED1-b reenvio do membro e conflito incerto não são repetidos automaticamente", async () => {
  const c = await montar("supervisor", [
    Response.json(
      { erro: { codigo: "CONFLICT", detalhes: { campo: "aviso", motivo: "entrega_incerta" } } },
      { status: 409 },
    ),
    Response.json({ ok: true, aviso: { status: "pendente" } }, { status: 202 }),
  ]);
  const d = { acao: "reenviar", numero: "123", status: "confirmado" };
  const r = await executarAvisos(c.sessao, d);
  expect(r.ok).toBe(false);
  expect(c.chamadas).toHaveLength(1);
  if (!r.ok) expect(r.erro.mensagem).toContain("já ter recebido");
  expect((await executarAvisos(c.sessao, { ...d, mesmo_incerto: true })).ok).toBe(true);
  expect(c.chamadas[1]?.body).toEqual({ mesmo_incerto: true });
});
