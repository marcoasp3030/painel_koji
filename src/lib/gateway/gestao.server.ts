import type { Json } from "./tipos";
import {
  FUSO_PAINEL,
  gestaoSchema,
  problemaGrade,
  type Unidade,
  type Grade,
  type PedidoGestao,
} from "./gestao";
import { AcessoNegado, autorizar, type ModuloGateway } from "./modulo.server";
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
  if (d.acao === "fuso_empresa" || d.acao === "aplicar_pausas" || d.acao === "aplicar_excecoes")
    return operacoesEmLote(t, d);
  if (d.acao === "historico") {
    partes = ["gestao", "alteracoes"];
    query["entidade"] = d.entidade;
    query["entidade_id"] = d.entidade_id;
    query["unidade_id"] = d.unidade_id;
    query["desde"] = d.desde;
    query["ate"] = d.ate;
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
  if (d.acao === "historico") {
    if (d.unidade_id && (d.entidade || d.entidade_id))
      return erro("unidade_id", "Filtre pela unidade ou pelo identificador, não pelos dois.");
    if (d.desde && d.ate && Date.parse(d.desde) >= Date.parse(d.ate))
      return erro("ate", "A data inicial precisa ser anterior à final.");
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
    let comPedidos = false;
    if (
      t.papel !== "membro" &&
      ["listar", "obter", "criar", "editar", "pausar", "reabrir", "horarios"].includes(d.acao)
    ) {
      try {
        const mod = await t.chamar<{ em_uso?: string[] }>("GET", ["modulos"]);
        comPedidos = Array.isArray(mod.dados.em_uso) && mod.dados.em_uso.includes("pedidos");
      } catch {
        comPedidos = false;
      }
    }
    // Sem pedidos em uso, não envia campos de entrega ao gateway.
    if (
      !comPedidos &&
      corpo &&
      typeof corpo === "object" &&
      !Array.isArray(corpo) &&
      (d.acao === "criar" || d.acao === "editar")
    ) {
      const limpo = { ...(corpo as Record<string, unknown>) };
      for (const k of [
        "taxa_entrega",
        "pedido_minimo",
        "area_entrega",
        "aceita_retirada",
        "formas_pagamento",
      ])
        delete limpo[k];
      corpo = limpo;
    }
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
        "cidade",
        "uf",
        "situacao",
        "pausa_motivo",
        ...(t.papel !== "membro" ? ["horarios", "whatsapp_pedidos"] : []),
        ...(comPedidos && t.papel !== "membro"
          ? ["taxa_entrega", "pedido_minimo", "area_entrega", "aceita_retirada", "formas_pagamento"]
          : []),
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
function fusoAceito(v: string) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}
function prazoInvalido(ate: string | undefined, indefinida: true | undefined) {
  if (Boolean(ate) === Boolean(indefinida)) return "Escolha prazo ou pausa indefinida.";
  if (
    ate &&
    (!/(Z|[+-]\d{2}:\d{2})$/.test(ate) ||
      !Number.isFinite(Date.parse(ate)) ||
      Date.parse(ate) <= Date.now() ||
      Date.parse(ate) > Date.now() + 60 * 86400000)
  )
    return "Escolha um horário futuro, no máximo 60 dias, com fuso.";
  return null;
}
async function operacoesEmLote(
  t: Awaited<ReturnType<Sessao["tenant"]>>,
  d: Extract<PedidoGestao, { acao: "fuso_empresa" | "aplicar_pausas" | "aplicar_excecoes" }>,
) {
  if (t.papel === "membro")
    throw new AcessoNegado(
      d.acao === "fuso_empresa"
        ? "O histórico é restrito ao administrador da empresa."
        : "Aplicar em várias unidades é restrito ao administrador da empresa.",
    );
  const erro = (campo: string, mensagem: string) => ({
    ok: false as const,
    erro: { campo, mensagem },
  });
  if (d.acao === "fuso_empresa") {
    autorizar(t.papel, "GET", []);
    try {
      const { dados } = await t.chamar("GET", []);
      const tz = (dados as { timezone?: unknown }).timezone;
      const valido = typeof tz === "string" && fusoAceito(tz);
      return {
        ok: true as const,
        dados: {
          timezone: valido ? tz : FUSO_PAINEL,
          origem: valido ? ("empresa" as const) : ("padrao" as const),
        },
      };
    } catch (e) {
      if (e instanceof AcessoNegado) throw e;
      if (e instanceof GatewayErro) return erro("corpo", mensagemParaUsuario(e));
      throw e;
    }
  }
  if (d.acao === "aplicar_pausas") {
    const msg = prazoInvalido(d.ate, d.indefinida);
    if (msg) return erro("ate", msg);
    const corpo = {
      ...(d.ate ? { ate: d.ate } : {}),
      ...(d.indefinida ? { indefinida: true } : {}),
      ...(d.motivo ? { motivo: d.motivo } : {}),
    };
    const resultados = [];
    for (const id of [...new Set(d.ids)]) {
      try {
        await t.chamar("POST", ["unidades", id, "pausar"], { corpo });
        resultados.push({ id, chave: id, ok: true });
      } catch (e) {
        if (e instanceof AcessoNegado) throw e;
        resultados.push({
          id,
          chave: id,
          ok: false,
          mensagem:
            e instanceof GatewayErro
              ? mensagemParaUsuario(e)
              : "Não foi possível confirmar esta unidade.",
        });
      }
    }
    return { ok: true as const, dados: { resultados } };
  }
  const fila: typeof d.itens = [];
  const vistas = new Set<string>();
  for (const item of d.itens) {
    const chave = `${item.id}:${item.data}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    if (
      Boolean(item.fechado) === (item.faixas !== undefined) ||
      (item.faixas !== undefined && item.faixas.length === 0)
    )
      return erro("faixas", "Escolha fechado ou faixas de horário.");
    if (item.faixas) {
      const p = problemaGrade({ seg: item.faixas } as Grade);
      if (p) return erro("faixas", p);
    }
    fila.push(item);
  }
  const resultados = [];
  for (const item of fila) {
    const chave = `${item.id}:${item.data}`;
    try {
      await t.chamar("POST", ["unidades", item.id, "excecoes"], {
        corpo: {
          data: item.data,
          ...(item.fechado ? { fechado: true } : {}),
          ...(item.faixas ? { faixas: item.faixas } : {}),
          ...(item.motivo ? { motivo: item.motivo } : {}),
        },
      });
      resultados.push({ id: item.id, data: item.data, chave, ok: true });
    } catch (e) {
      if (e instanceof AcessoNegado) throw e;
      resultados.push({
        id: item.id,
        data: item.data,
        chave,
        ok: false,
        mensagem:
          e instanceof GatewayErro
            ? mensagemParaUsuario(e)
            : "Não foi possível confirmar esta unidade.",
      });
    }
  }
  return { ok: true as const, dados: { resultados } };
}
