import type { Json } from "./tipos";
import { gestaoSchema, problemaGrade, type Unidade, type Grade } from "./gestao";
import { autorizar, type ModuloGateway } from "./modulo.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import type { MetodoGateway } from "./cliente.server";
type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;
export async function executarGestao(
  sessao: Sessao,
  entrada: unknown,
): Promise<{ ok: false; erro: { campo: string; mensagem: string } } | { ok: true; dados: Json }> {
  const parsed = gestaoSchema.safeParse(entrada);
  if (!parsed.success)
    return {
      ok: false as const,
      erro: {
        campo: String(parsed.error.issues[0]?.path.at(-1) ?? "corpo"),
        mensagem: parsed.error.issues[0]?.message ?? "Confira os campos.",
      },
    };
  const d = parsed.data;
  const t = await sessao.tenant(d.empresa);
  let metodo: MetodoGateway = "GET";
  let partes: string[] = [];
  let corpo: unknown;
  const query: Record<string, string | number | undefined> = {};
  if (d.acao === "listar") partes = ["unidades"];
  if (d.acao === "obter") partes = ["unidades", d.id];
  if (d.acao === "agenda") {
    partes = ["unidades", d.id, "agenda"];
    query["dias"] = 7;
  }
  if (d.acao === "criar") {
    partes = ["unidades"];
    metodo = "POST";
    corpo = d.dados;
  }
  if (d.acao === "editar") {
    partes = ["unidades", d.id];
    metodo = "PATCH";
    corpo = d.dados;
  }
  if (d.acao === "horarios") {
    partes = ["unidades", d.id, "horarios"];
    metodo = "PUT";
    corpo = d.grade;
  }
  if (d.acao === "pausar") {
    partes = ["unidades", d.id, "pausar"];
    metodo = "POST";
    corpo = {
      ...(d.ate ? { ate: d.ate } : {}),
      ...(d.indefinida ? { indefinida: true } : {}),
      ...(d.motivo ? { motivo: d.motivo } : {}),
    };
  }
  if (d.acao === "reabrir") {
    partes = ["unidades", d.id, "reabrir"];
    metodo = "POST";
  }
  if (d.acao === "excecoes") {
    partes = ["unidades", d.id, "excecoes"];
    query["desde"] = d.desde;
    query["ate"] = d.ate;
  }
  if (d.acao === "excecao") {
    partes = ["unidades", d.id, "excecoes"];
    metodo = "POST";
    corpo = {
      data: d.data,
      ...(d.fechado ? { fechado: true } : {}),
      ...(d.faixas ? { faixas: d.faixas } : {}),
      ...(d.motivo ? { motivo: d.motivo } : {}),
    };
  }
  if (d.acao === "excluir_excecao") {
    partes = ["unidades", d.id, "excecoes", String(d.eid)];
    metodo = "DELETE";
  }
  if (d.acao === "historico") {
    partes = ["gestao", "alteracoes"];
    query["entidade"] = d.entidade;
    query["entidade_id"] = d.entidade_id;
    query["cursor"] = d.cursor;
    query["limite"] = 50;
  }
  autorizar(t.papel, metodo, partes, corpo);
  const erro = (campo: string, mensagem: string) => ({
    ok: false as const,
    erro: { campo, mensagem },
  });
  if (d.acao === "pausar") {
    if (Boolean(d.ate) === Boolean(d.indefinida))
      return erro("ate", "Escolha prazo ou pausa indefinida.");
    if (
      d.ate &&
      (!/(Z|[+-]\d{2}:\d{2})$/.test(d.ate) ||
        !Number.isFinite(Date.parse(d.ate)) ||
        Date.parse(d.ate) <= Date.now() ||
        Date.parse(d.ate) > Date.now() + 60 * 86400000)
    )
      return erro("ate", "Escolha um horário futuro, no máximo 60 dias, com fuso.");
  }
  if (d.acao === "excecao") {
    if (
      Boolean(d.fechado) === (d.faixas !== undefined) ||
      (d.faixas !== undefined && d.faixas.length === 0)
    )
      return erro("faixas", "Escolha fechado ou faixas de horário.");
    if (d.faixas) {
      const p = problemaGrade({ seg: d.faixas } as Grade);
      if (p) return erro("faixas", p);
    }
  }
  try {
    const { dados } = await t.chamar(metodo, partes, { corpo, query });
    // Projeção impede expor grade/configurações de gestão ao membro pela leitura de unidade.
    function unidade(v: unknown) {
      const u = v as Unidade;
      const r: Record<string, unknown> = {};
      for (const k of [
        "id",
        "nome",
        "codigo",
        "endereco",
        "telefone",
        "ativo",
        "fuso",
        "fuso_efetivo",
        "situacao",
        "pausa_motivo",
        ...(t.papel !== "membro" ? ["horarios", "whatsapp_pedidos"] : []),
      ])
        r[k] = (u as unknown as Record<string, unknown>)[k];
      return r;
    }
    const resultado =
      d.acao === "listar"
        ? { itens: (dados as { itens: unknown[] }).itens.map(unidade) }
        : ["obter", "criar", "editar", "pausar", "reabrir", "horarios"].includes(d.acao)
          ? unidade(dados)
          : dados;
    return { ok: true as const, dados: resultado as Json };
  } catch (e) {
    if (e instanceof GatewayErro) {
      const campo = typeof e.detalhes["campo"] === "string" ? e.detalhes["campo"] : "corpo";
      return erro(campo, mensagemParaUsuario(e));
    }
    throw e;
  }
}
