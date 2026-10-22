import type { Json } from "./tipos";
import { pedidoSchema, type PedidoEntrada } from "./pedidos";
import { AcessoNegado, type ModuloGateway } from "./modulo.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;

export async function executarPedidos(
  sessao: Sessao,
  entrada: unknown,
): Promise<{ ok: false; erro: { campo: string; mensagem: string } } | { ok: true; dados: Json }> {
  const parsed = pedidoSchema.safeParse(entrada);
  if (!parsed.success)
    return {
      ok: false,
      erro: {
        campo: String(parsed.error.issues[0]?.path.at(-1) ?? "corpo"),
        mensagem: parsed.error.issues[0]?.message ?? "Confira os campos.",
      },
    };
  const d = parsed.data;
  const t = await sessao.tenant(d.empresa);
  const erro = (campo: string, mensagem: string) => ({
    ok: false as const,
    erro: { campo, mensagem },
  });
  if (d.acao === "status") {
    const motivo = d.motivo?.trim();
    if (d.status === "cancelado" && (!motivo || motivo.length < 3))
      return erro("motivo", "O cancelamento precisa de um motivo com pelo menos 3 caracteres.");
    if (d.previsao_min !== undefined && d.status !== "confirmado" && d.status !== "em_preparo")
      return erro("previsao_min", "A previsão só vale ao confirmar ou ao iniciar o preparo.");
    if (
      d.previsao_min !== undefined &&
      (!Number.isInteger(d.previsao_min) || d.previsao_min < 1 || d.previsao_min > 600)
    )
      return erro("previsao_min", "A previsão é um número de minutos, de 1 a 600.");
  }
  if (d.acao === "listar" && d.desde && d.ate && Date.parse(d.desde) >= Date.parse(d.ate))
    return erro("ate", "A data inicial precisa ser anterior à final.");
  try {
    if (d.acao === "contagem") {
      if (d.so_reais) {
        // O endpoint /contagem ainda não filtra por origem; o menu conta só reais via lista.
        let total = 0;
        let maisAntigo: string | null = null;
        let cursor: number | undefined;
        for (let n = 0; n < 20; n++) {
          const { dados } = await t.chamar<{
            itens: { criado_em?: string }[];
            proximo_cursor: number | null;
          }>("GET", ["pedidos"], {
            query: {
              status: "aguardando_loja",
              origem: "real",
              limite: 100,
              ...(cursor ? { cursor } : {}),
            },
          });
          const itens = dados.itens ?? [];
          total += itens.length;
          const ultimo = itens.at(-1)?.criado_em;
          if (ultimo) maisAntigo = ultimo;
          if (!dados.proximo_cursor) break;
          cursor = dados.proximo_cursor;
        }
        return {
          ok: true,
          dados: {
            aguardando_loja: { total, mais_antigo_em: maisAntigo, por_unidade: [] },
            em_andamento: {
              confirmado: 0,
              em_preparo: 0,
              pronto_retirada: 0,
              saiu_entrega: 0,
            },
            avisos_com_falha: 0,
          } as Json,
        };
      }
      const { dados } = await t.chamar("GET", ["pedidos", "contagem"]);
      return { ok: true, dados: dados as Json };
    }
    if (d.acao === "detalhe") {
      const { dados } = await t.chamar("GET", ["pedidos", d.numero]);
      await comNomeAtual(t, [dados as PedidoComCliente]);
      return { ok: true, dados: dados as Json };
    }
    if (d.acao === "status") {
      const motivo = d.motivo?.trim();
      const { dados } = await t.chamar("POST", ["pedidos", d.numero, "status"], {
        corpo: {
          status: d.status,
          ...(motivo ? { motivo } : {}),
          ...(d.previsao_min !== undefined ? { previsao_min: d.previsao_min } : {}),
        },
      });
      return { ok: true, dados: dados as Json };
    }
    const { dados } = await t.chamar<{ itens?: PedidoComCliente[] }>("GET", ["pedidos"], {
      query: queryLista(d),
    });
    await comNomeAtual(t, dados.itens ?? []);
    return { ok: true, dados: dados as Json };
  } catch (e) {
    if (e instanceof AcessoNegado) throw e;
    if (e instanceof GatewayErro) {
      if (e.codigo === "CONFLICT" && e.detalhes["campo"] === "status")
        return erro("status", "Este pedido já foi atualizado");
      const campo = typeof e.detalhes["campo"] === "string" ? e.detalhes["campo"] : "corpo";
      return erro(campo, mensagemParaUsuario(e));
    }
    throw e;
  }
}

type Escopo = Awaited<ReturnType<Sessao["tenant"]>>;
type PedidoComCliente = {
  conversation_id?: string | null;
  cliente?: {
    nome?: string | null;
    telefone?: string | null;
    nome_exibicao?: string | null;
    nome_origem?: string | null;
  } | null;
};
type NomeAtual = { nome_exibicao: string; nome_origem: string | null };

/** Nomes recentes por tenant: a lista de pedidos recarrega a cada 15 s por coluna. */
const RECENTES_TTL_MS = 30_000;
const recentes = new Map<string, { em: number; nomes: Map<string, NomeAtual> }>();
const MAX_BUSCAS_AVULSAS = 5;
export function esquecerNomesRecentes(tenant: string) {
  recentes.delete(tenant);
}

async function nomesDe(t: Escopo, query: Record<string, string | number>) {
  const { dados } = await t.chamar<{
    itens: {
      conversation_id: string;
      nome_exibicao?: string | null;
      nome_origem?: string | null;
    }[];
  }>("GET", ["conversas"], { query });
  const nomes = new Map<string, NomeAtual>();
  for (const c of dados.itens ?? []) {
    if (c.nome_exibicao)
      nomes.set(c.conversation_id, {
        nome_exibicao: c.nome_exibicao,
        nome_origem: c.nome_origem ?? null,
      });
  }
  return nomes;
}

/**
 * O gateway grava `cliente.nome` no fechamento e não o atualiza (ESPEC_PED1 §14).
 * Para o cartão e o detalhe mostrarem o mesmo nome da conversa, junta o `nome_exibicao`
 * atual pela conversa do pedido. Sem conversa ou se a leitura falhar, fica o nome do pedido.
 */
export async function comNomeAtual(t: Escopo, pedidos: PedidoComCliente[]) {
  const alvos = pedidos.filter((p) => p.cliente && p.conversation_id);
  if (!alvos.length) return;
  try {
    let cache = recentes.get(t.id);
    if (!cache || Date.now() - cache.em > RECENTES_TTL_MS) {
      cache = { em: Date.now(), nomes: await nomesDe(t, { ordem: "recentes", limite: 100 }) };
      recentes.set(t.id, cache);
    }
    const nomes = new Map(cache.nomes);
    const faltam = [
      ...new Set(
        alvos
          .filter((p) => !nomes.has(p.conversation_id!))
          .map((p) => (p.cliente?.telefone ?? "").replace(/\D/g, ""))
          .filter((d) => d.length >= 8),
      ),
    ].slice(0, MAX_BUSCAS_AVULSAS);
    for (const digitos of faltam) {
      for (const [id, nome] of await nomesDe(t, { busca: digitos, limite: 100 }))
        nomes.set(id, nome);
    }
    for (const p of alvos) {
      const atual = nomes.get(p.conversation_id!);
      if (atual && p.cliente) Object.assign(p.cliente, atual);
    }
  } catch (e) {
    if (e instanceof AcessoNegado) throw e;
    // Nome atual é complemento: sem ele o pedido segue com o nome gravado no fechamento.
  }
}

function queryLista(d: Extract<PedidoEntrada, { acao: "listar" }>) {
  return {
    status: d.status?.length ? d.status.join(",") : undefined,
    origem: d.origem?.length ? d.origem.join(",") : undefined,
    unidade: d.unidade,
    modalidade: d.modalidade,
    desde: d.desde,
    ate: d.ate,
    busca: d.busca,
    cursor: d.cursor ?? undefined,
    limite: d.limite ?? 50,
  };
}
