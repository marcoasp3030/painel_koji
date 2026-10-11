import { expect, test } from "bun:test";
import { criarClienteGateway } from "./cliente.server";
import { criarModuloGateway } from "./modulo.server";
import { executarPedidos } from "./pedidos.server";
import { acoesPedido, tempoDesde, whatsappPedido } from "./pedidos";

async function montar(papel = "admin", respostas: Response[] = []) {
  const chamadas: {
    url: string;
    method: string | undefined;
    body: unknown;
    ator: string | null;
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
        const headers = new Headers(init.headers);
        chamadas.push({
          url: String(url),
          method: init.method,
          body: init.body ? JSON.parse(String(init.body)) : null,
          ator: headers.get("X-Actor"),
        });
        return respostas.shift() ?? Response.json({ itens: [], proximo_cursor: null });
      }) as typeof fetch,
    }),
  });
  return { sessao: await modulo.sessao({ userId: "u", email: null }), chamadas };
}

test("PED1-a ações saem só de proximos_status", () => {
  expect(acoesPedido(["pronto_retirada", "concluido", "cancelado"]).map((a) => a.rotulo)).toEqual([
    "Pronto para retirada",
    "Concluir",
    "Cancelar",
  ]);
  expect(acoesPedido(["concluido"]).some((a) => a.status === "recusado")).toBe(false);
  expect(acoesPedido(["confirmado"])[0]?.previsao).toBe(true);
  expect(acoesPedido(["em_preparo"])[0]?.previsao).toBe(true);
  expect(acoesPedido(["cancelado"])[0]?.motivo).toBe("obrigatorio");
  expect(acoesPedido(["recusado"])[0]?.motivo).toBe("opcional");
  expect(acoesPedido(["inventado", "concluido", "concluido"])).toEqual([
    {
      status: "concluido",
      rotulo: "Concluir",
      previsao: false,
      motivo: null,
    },
  ]);
  expect(whatsappPedido("+5511947281513")).toBe("+55 11 94728-1513");
  expect(whatsappPedido(null)).toBeNull();
  expect(tempoDesde("2026-10-10T21:40:00Z", Date.parse("2026-10-10T22:10:00Z"))).toBe("há 30 min");
});

test("PED1-a isolamento: outra empresa não chama o gateway", async () => {
  for (const op of [
    { acao: "listar" },
    { acao: "contagem" },
    { acao: "detalhe", numero: "59859" },
    { acao: "status", numero: "59859", status: "confirmado" },
  ]) {
    const c = await montar();
    await expect(executarPedidos(c.sessao, { ...op, empresa: "outro" })).rejects.toThrow();
    expect(c.chamadas).toHaveLength(0);
  }
});

test("PED1-a membro muda o status e lê pedidos da própria empresa", async () => {
  const c = await montar("membro", [Response.json({ numero: "59859", status: "em_preparo" })]);
  const r = await executarPedidos(c.sessao, {
    acao: "status",
    numero: "59859",
    status: "em_preparo",
  });
  expect(r.ok).toBe(true);
  expect(c.chamadas[0]?.method).toBe("POST");
  expect(c.chamadas[0]?.url).toBe(
    "http://gateway:8000/admin/v1/tenants/bykoji/pedidos/59859/status",
  );
  expect(c.chamadas[0]?.body).toEqual({ status: "em_preparo" });
  expect(c.chamadas[0]?.ator).toBe("sessao@exemplo.com");
  const lista = await montar("membro");
  await executarPedidos(lista.sessao, {
    acao: "listar",
    status: ["pronto_retirada", "saiu_entrega"],
    modalidade: "delivery",
    busca: "Marco",
  });
  const url = new URL(lista.chamadas[0]!.url);
  expect(url.pathname).toBe("/admin/v1/tenants/bykoji/pedidos");
  expect(url.searchParams.get("status")).toBe("pronto_retirada,saiu_entrega");
  expect(url.searchParams.get("modalidade")).toBe("delivery");
  expect(url.searchParams.get("busca")).toBe("Marco");
  expect(url.searchParams.get("limite")).toBe("50");
});

test("PED1-a cancelar sem motivo e previsão inválida não chamam o gateway", async () => {
  const c = await montar();
  const ausente = await executarPedidos(c.sessao, {
    acao: "status",
    numero: "59859",
    status: "cancelado",
  });
  expect(ausente.ok).toBe(false);
  const sem = await executarPedidos(c.sessao, {
    acao: "status",
    numero: "59859",
    status: "cancelado",
    motivo: "ok",
  });
  expect(sem).toEqual({
    ok: false,
    erro: {
      campo: "motivo",
      mensagem: "O cancelamento precisa de um motivo com pelo menos 3 caracteres.",
    },
  });
  const previsao = await executarPedidos(c.sessao, {
    acao: "status",
    numero: "59859",
    status: "concluido",
    previsao_min: 40,
  });
  expect(previsao.ok).toBe(false);
  if (!previsao.ok) expect(previsao.erro.campo).toBe("previsao_min");
  const fora = await executarPedidos(c.sessao, {
    acao: "status",
    numero: "59859",
    status: "confirmado",
    previsao_min: 0,
  });
  expect(fora.ok).toBe(false);
  expect(c.chamadas).toHaveLength(0);
});

test("PED1-a 409 recarrega a frase e guarda o status atual", async () => {
  for (const motivo of [
    "status_final",
    "mesmo_status",
    "nao_pode_voltar",
    "modalidade_incompativel",
    "recusa_so_aguardando",
  ]) {
    const c = await montar("admin", [
      Response.json(
        {
          erro: {
            codigo: "CONFLICT",
            mensagem: "conflito interno",
            detalhes: { campo: "status", status: "confirmado", motivo },
          },
        },
        { status: 409 },
      ),
    ]);
    const r = await executarPedidos(c.sessao, {
      acao: "status",
      numero: "59859",
      status: "confirmado",
      previsao_min: 40,
    });
    expect(r).toEqual({
      ok: false,
      erro: { campo: "status", mensagem: "Este pedido já foi atualizado" },
    });
    expect(c.chamadas[0]?.body).toEqual({ status: "confirmado", previsao_min: 40 });
  }
});
