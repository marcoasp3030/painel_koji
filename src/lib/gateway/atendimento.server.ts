import { atendimentoSchema, type ErroAtendimento, type ResultadoAtendimento } from "./atendimento";
import { AcessoNegado, type ModuloGateway } from "./modulo.server";
import { GatewayErro, mensagemParaUsuario } from "./erros";
import type { Json } from "./tipos";

type Sessao = Awaited<ReturnType<ModuloGateway["sessao"]>>;

const ESCRITAS = new Set(["salvar", "descartar", "publicar", "restaurar"]);
const SEM_PERMISSAO =
  "Sem permissão para alterar o comportamento do agente. Só administradores da empresa e da plataforma editam.";
const CONFLITOS: Record<string, string> = {
  sem_rascunho: "Não há rascunho para publicar. A tela foi atualizada.",
  sem_alteracoes: "Nada a publicar: o rascunho é igual ao que está em vigor.",
  versao_desatualizada:
    "Outra versão foi publicada depois deste rascunho. A tela foi atualizada; confira e atualize o rascunho.",
  confirmacao_necessaria: "Confirme os trechos indicados para publicar.",
  texto_bloqueado: "O texto parece instrução de sistema e não pode ser publicado.",
};

/** Ações da tela "Comportamento do agente" no escopo da empresa ou de um agente. */
export async function executarAtendimento(
  sessao: Sessao,
  entrada: unknown,
): Promise<ResultadoAtendimento> {
  const p = atendimentoSchema.safeParse(entrada);
  if (!p.success)
    return {
      ok: false,
      erro: { status: 400, mensagem: p.error.issues[0]?.message ?? "Confira os campos." },
    };
  const d = p.data;
  const t = await sessao.tenant(d.empresa);
  try {
    if (ESCRITAS.has(d.acao) && t.papel === "membro")
      return { ok: false, erro: { status: 403, mensagem: SEM_PERMISSAO } };
    if (d.agente) await (await import("./ocultos")).exigirAgenteVisivel(t, d.agente);
    const escopo = d.agente ? ["agentes", d.agente, "atendimento"] : ["atendimento"];
    let r: { dados: unknown };
    switch (d.acao) {
      case "ler":
        r = await t.chamar("GET", escopo);
        break;
      case "salvar":
        r = await t.chamar("PUT", [...escopo, "rascunho"], {
          corpo: {
            baseado_em: d.baseado_em,
            ...(d.perfil ? { perfil: d.perfil } : {}),
            ...(d.comportamentos ? { comportamentos: d.comportamentos } : {}),
          },
        });
        break;
      case "descartar":
        r = await t.chamar("DELETE", [...escopo, "rascunho"]);
        break;
      case "publicar":
        r = await t.chamar("POST", [...escopo, "publicar"], {
          corpo: {
            baseado_em: d.baseado_em,
            ...(d.nota ? { nota: d.nota } : {}),
            confirmar_avisos: d.confirmar_avisos === true,
          },
        });
        break;
      case "versoes":
        r = await t.chamar("GET", [...escopo, "versoes"], {
          query: { limite: 20, ...(d.cursor ? { cursor: d.cursor } : {}) },
        });
        break;
      case "versao":
        r = await t.chamar("GET", [...escopo, "versoes", String(d.versao)]);
        break;
      case "restaurar":
        r = await t.chamar("POST", [...escopo, "versoes", String(d.versao), "restaurar"], {
          corpo: d.nota ? { nota: d.nota } : {},
        });
        break;
      case "previa":
        r = await t.chamar("POST", [...escopo, "previa"], { corpo: { fonte: d.fonte } });
        break;
    }
    return { ok: true, dados: r.dados as Json };
  } catch (e) {
    if (e instanceof AcessoNegado && ESCRITAS.has(d.acao))
      return { ok: false, erro: { status: 403, mensagem: SEM_PERMISSAO } };
    if (!(e instanceof GatewayErro)) throw e;
    return { ok: false, erro: traduzirErro(e) };
  }
}

/** Erro do gateway no formato da tela: motivo, campos (todos), bloqueios e avisos com trecho. */
export function traduzirErro(e: GatewayErro): ErroAtendimento {
  const det = e.detalhes;
  const motivo = typeof det["motivo"] === "string" ? det["motivo"] : undefined;
  const lista = <T>(v: unknown, ok: (x: Record<string, unknown>) => boolean) =>
    Array.isArray(v)
      ? (v.filter((x) => x && typeof x === "object" && ok(x as Record<string, unknown>)) as T[])
      : undefined;
  const comTrecho = (x: Record<string, unknown>) =>
    typeof x["campo"] === "string" &&
    typeof x["motivo"] === "string" &&
    typeof x["trecho"] === "string";
  const campos = lista<{ campo: string; motivo: string }>(
    det["campos"],
    (x) => typeof x["campo"] === "string" && typeof x["motivo"] === "string",
  );
  const bloqueios = lista<{ campo: string; motivo: string; trecho: string }>(
    det["bloqueios"],
    comTrecho,
  );
  const avisos = lista<{ campo: string; motivo: string; trecho: string }>(det["avisos"], comTrecho);
  const versao = det["versao_publicada"];
  let mensagem: string;
  if (e.status === 403) mensagem = SEM_PERMISSAO;
  else if (e.status === 404) mensagem = "Empresa ou agente não encontrado.";
  else if (motivo && CONFLITOS[motivo]) mensagem = CONFLITOS[motivo];
  else if (campos?.length)
    mensagem = `${campos.length === 1 ? "Um campo" : `${campos.length} campos`} com erro.`;
  else if (bloqueios?.length) mensagem = CONFLITOS["texto_bloqueado"]!;
  else mensagem = mensagemParaUsuario(e);
  return {
    status: e.status,
    mensagem,
    ...(motivo ? { motivo } : {}),
    ...(campos?.length ? { campos } : {}),
    ...(bloqueios?.length ? { bloqueios } : {}),
    ...(avisos?.length ? { avisos } : {}),
    ...(typeof versao === "number" ? { versao_publicada: versao } : {}),
  };
}
