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
      const { dados } = await t.chamar("GET", ["pedidos", "contagem"]);
      return { ok: true, dados: dados as Json };
    }
    if (d.acao === "detalhe") {
      const { dados } = await t.chamar("GET", ["pedidos", d.numero]);
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
    const { dados } = await t.chamar("GET", ["pedidos"], { query: queryLista(d) });
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

function queryLista(d: Extract<PedidoEntrada, { acao: "listar" }>) {
  return {
    status: d.status?.length ? d.status.join(",") : undefined,
    unidade: d.unidade,
    modalidade: d.modalidade,
    desde: d.desde,
    ate: d.ate,
    busca: d.busca,
    cursor: d.cursor ?? undefined,
    limite: d.limite ?? 50,
  };
}
