import { expect, test } from "bun:test";
import { criarClienteGateway } from "./cliente.server";
import { criarModuloGateway } from "./modulo.server";
import { esquecerNomesRecentes, executarPedidos } from "./pedidos.server";
import {
  acoesPedido,
  nomeClientePedido,
  tempoDesde,
  whatsappPedido,
  type PedidoLista,
} from "./pedidos";

async function montar(papel = "gestor", respostas: Response[] = []) {
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
      vinculos: [{ gatewayTenantId: "bykoji", ativo: true, admin: papel === "gestor" }],
    }),
    cliente: criarClienteGateway({
      url: "http://gateway:8000/admin/v1",
      chave: "sintetica-nao-segredo-real-123456",
      chavePlataforma: "sintetica-nao-segredo-real-123456",
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
  const c = await montar("funcionario", [Response.json({ numero: "59859", status: "em_preparo" })]);
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
  const lista = await montar("funcionario");
  await executarPedidos(lista.sessao, {
    acao: "listar",
    status: ["pronto_retirada", "saiu_entrega"],
    modalidade: "delivery",
    origem: ["real", "piloto"],
    busca: "Marco",
  });
  const url = new URL(lista.chamadas[0]!.url);
  expect(url.pathname).toBe("/admin/v1/tenants/bykoji/pedidos");
  expect(url.searchParams.get("status")).toBe("pronto_retirada,saiu_entrega");
  expect(url.searchParams.get("modalidade")).toBe("delivery");
  expect(url.searchParams.get("origem")).toBe("real,piloto");
  expect(url.searchParams.get("busca")).toBe("Marco");
  expect(url.searchParams.get("limite")).toBe("50");
});

test("LGPD1 contagem so_reais lista pedidos com origem=real", async () => {
  const c = await montar("gestor", [
    Response.json({
      itens: [
        { numero: "1", criado_em: "2026-10-16T12:00:00-03:00" },
        { numero: "2", criado_em: "2026-10-16T11:00:00-03:00" },
      ],
      proximo_cursor: null,
    }),
  ]);
  const r = await executarPedidos(c.sessao, { acao: "contagem", so_reais: true });
  expect(r.ok).toBe(true);
  if (r.ok) {
    const d = r.dados as {
      aguardando_loja: { total: number; mais_antigo_em: string | null };
    };
    expect(d.aguardando_loja.total).toBe(2);
    expect(d.aguardando_loja.mais_antigo_em).toBe("2026-10-16T11:00:00-03:00");
  }
  const url = new URL(c.chamadas[0]!.url);
  expect(url.pathname).toBe("/admin/v1/tenants/bykoji/pedidos");
  expect(url.searchParams.get("status")).toBe("aguardando_loja");
  expect(url.searchParams.get("origem")).toBe("real");
  expect(url.searchParams.get("limite")).toBe("100");
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
    const c = await montar("gestor", [
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

const pedidoBase = {
  numero: "59859",
  status: "em_preparo",
  conversation_id: "bykoji:can_1:5511947281513",
  cliente: { nome: "Marquinho", telefone: "+5511947281513", canal: null },
};

test("PED1-c cartão e detalhe usam o nome_exibicao atual da conversa", async () => {
  esquecerNomesRecentes("bykoji");
  const c = await montar("funcionario", [
    Response.json({ itens: [pedidoBase, { ...pedidoBase, numero: "2", conversation_id: null }] }),
    Response.json({
      itens: [
        {
          conversation_id: pedidoBase.conversation_id,
          nome_exibicao: "Marco Silva",
          nome_origem: "cadastro",
        },
      ],
      proximo_cursor: null,
    }),
  ]);
  const r = await executarPedidos(c.sessao, { acao: "listar" });
  expect(r.ok).toBe(true);
  const itens = (r as { dados: { itens: PedidoLista[] } }).dados.itens;
  expect(itens[0]?.cliente).toMatchObject({ nome: "Marquinho", nome_exibicao: "Marco Silva" });
  expect(nomeClientePedido(itens[0]?.cliente).nome).toBe("Marco Silva");
  expect(nomeClientePedido(itens[0]?.cliente).origem).toBe("cadastro");
  expect(itens[1]?.cliente).not.toHaveProperty("nome_exibicao");
  const conversas = new URL(c.chamadas[1]!.url);
  expect(conversas.pathname).toBe("/admin/v1/tenants/bykoji/conversas");
  expect(conversas.searchParams.get("ordem")).toBe("recentes");
  expect(c.chamadas).toHaveLength(2);

  // Detalhe: aproveita os nomes recentes e não repete a leitura.
  c.chamadas.length = 0;
  const d = await montar("funcionario", [Response.json(pedidoBase)]);
  const det = await executarPedidos(d.sessao, { acao: "detalhe", numero: "59859" });
  expect((det as { dados: PedidoLista }).dados.cliente.nome_exibicao).toBe("Marco Silva");
  expect(d.chamadas).toHaveLength(1);
});

test("PED1-c conversa fora das recentes: busca pelo telefone; falha mantém o nome do pedido", async () => {
  esquecerNomesRecentes("bykoji");
  const c = await montar("gestor", [
    Response.json(pedidoBase),
    Response.json({ itens: [], proximo_cursor: null }),
    Response.json({
      itens: [
        {
          conversation_id: pedidoBase.conversation_id,
          nome_exibicao: "+55 11 94728-1513",
          nome_origem: "telefone",
        },
      ],
    }),
  ]);
  const r = await executarPedidos(c.sessao, { acao: "detalhe", numero: "59859" });
  const cliente = (r as { dados: PedidoLista }).dados.cliente;
  expect(new URL(c.chamadas[2]!.url).searchParams.get("busca")).toBe("5511947281513");
  // Cadastro apagado e sem outro nome: segue a conversa (telefone), não o nome antigo do pedido.
  expect(nomeClientePedido(cliente)).toMatchObject({
    nome: "+55 11 94728-1513",
    temNome: false,
    origem: null,
  });

  esquecerNomesRecentes("bykoji");
  const falha = await montar("gestor", [
    Response.json(pedidoBase),
    Response.json({ erro: { codigo: "UNAVAILABLE" } }, { status: 503 }),
  ]);
  const f = await executarPedidos(falha.sessao, { acao: "detalhe", numero: "59859" });
  expect(f.ok).toBe(true);
  expect(nomeClientePedido((f as { dados: PedidoLista }).dados.cliente).nome).toBe("Marquinho");
  expect(nomeClientePedido({ nome: null, telefone: null, canal: null }).nome).toBe(
    "Cliente sem nome",
  );
});
