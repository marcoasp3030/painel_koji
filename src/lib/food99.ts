/**
 * 99FOOD1-a/b: credenciais do app (plataforma), lojas por unidade e pedidos (gestor+).
 * Rótulos e conferências do painel; a chamada HTTP fica no servidor.
 */

/** Teste = app de teste da 99; produção = lojas reais. */
export type AmbienteFood99 = "teste" | "producao";

export type CredenciaisFood99 = {
  configurado: boolean;
  app_id_final: string | null;
  /** Presente quando configurado; nulo se ainda não há credencial. */
  ambiente: AmbienteFood99 | null;
  webhook_url: string;
  atualizado_por: string | null;
  atualizado_em: string | null;
};

export type SituacaoFood99 =
  | "aguardando_autorizacao"
  | "conectada"
  | "sem_permissao"
  | string;

export type LojaFood99 = {
  id: string;
  unidade: string;
  shop_id: string | null;
  nome: string | null;
  situacao: SituacaoFood99;
  erro_codigo: string | number | null;
  conferida_em: string | null;
  criado_por: string | null;
  criado_em: string | null;
};

export type ListaLojasFood99 = {
  configurado: boolean;
  aviso_conexao: string;
  itens: LojaFood99[];
};

export type ResultadoConectarFood99 = {
  loja: LojaFood99;
  url_autorizacao: string;
  aviso: string;
};

export const TEXTO_AJUDA_FOOD99 =
  "No portal 99Food: Application Management → seu app → View Details. Cole o Callback Address no app.";

export const TEXTO_PLATAFORMA_NAO_CONFIGUROU =
  "A plataforma ainda não configurou a 99Food";

/** Plataforma vê Integrações → 99Food. */
export function podeVerCredenciaisFood99(papel: string | null | undefined) {
  return papel === "plataforma";
}

/** Gestor e plataforma gerenciam lojas da empresa. */
export function podeGerirLojasFood99(papel: string | null | undefined) {
  return papel === "plataforma" || papel === "gestor";
}

export function rotuloSituacaoFood99(s: SituacaoFood99 | string) {
  if (s === "conectada") return "Conectada";
  if (s === "aguardando_autorizacao") return "Aguardando autorização";
  if (s === "sem_permissao") return "Sem permissão";
  return s.replace(/_/g, " ");
}

export function rotuloAmbienteFood99(a: AmbienteFood99 | null | undefined): string | null {
  if (a === "producao") return "Produção";
  if (a === "teste") return "Teste";
  return null;
}

/** Status do bloco Credenciais: nunca inclui o Secret. */
export function textoStatusCredenciaisFood99(c: CredenciaisFood99): string {
  if (!c.configurado) return "Não configurado";
  const final = (c.app_id_final || "").trim() || "????";
  const amb = rotuloAmbienteFood99(c.ambiente);
  const base = amb
    ? `Configurado (App ID …${final}) — Ambiente: ${amb}`
    : `Configurado (App ID …${final})`;
  const quem = (c.atualizado_por || "").trim();
  const quando = dataCurtaFood99(c.atualizado_em);
  if (quem && quando) return `${base}, alterado por ${quem} em ${quando}`;
  if (quem) return `${base}, alterado por ${quem}`;
  return base;
}

/** Pedidos → 99Food no menu só quando a empresa tem ao menos uma loja. */
export function mostrarMenuPedidosFood99(
  itens: { id?: string }[] | null | undefined,
): boolean {
  return (itens?.length ?? 0) > 0;
}

function dataCurtaFood99(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

/** Confirmação de desconectar: nome da loja ou código da unidade. */
export function confirmacaoDesconectarFood99Confere(
  digitado: string,
  loja: { nome: string | null; unidade: string },
) {
  const t = digitado.trim();
  if (!t) return false;
  const nome = (loja.nome || "").trim();
  return t === nome || t === loja.unidade;
}

export function nomeParaConfirmacaoDesconectar(loja: {
  nome: string | null;
  unidade: string;
}) {
  const nome = (loja.nome || "").trim();
  return nome || loja.unidade;
}

/**
 * Mensagem para a tela: motivos do contrato 99FOOD1-a com texto fixo.
 */
export function mensagemErroFood99(erro: {
  mensagem?: string | null;
  status?: number;
  detalhes?: Record<string, unknown> | null;
}): string {
  const motivo = erro.detalhes?.["motivo"];
  const campo = erro.detalhes?.["campo"];
  if (erro.status === 403 && motivo === "papel_sem_credencial") {
    return "Trocar as credenciais da 99Food exige a chave de plataforma no servidor do painel.";
  }
  if (erro.status === 400 && motivo === "credenciais_recusadas") {
    return "A 99Food não reconheceu este App ID. Nada foi gravado.";
  }
  if (erro.status === 502 && motivo === "nao_desvinculou") {
    return (
      erro.mensagem?.trim() ||
      "A 99Food não desvinculou a loja. Tente de novo ou peça para remover só no gateway."
    );
  }
  if (erro.status === 502 || motivo === "indisponivel" || motivo === "limite") {
    return "A 99Food não respondeu. Tente de novo em instantes.";
  }
  if (erro.status === 503 && motivo === "nao_configurado") {
    return TEXTO_PLATAFORMA_NAO_CONFIGUROU;
  }
  if (erro.status === 409 && motivo === "ja_conectada") {
    return "Esta unidade já está conectada à 99Food. Desconecte antes de conectar outra loja.";
  }
  if (erro.status === 400 && motivo === "confirmacao") {
    return "Digite o nome da loja (ou o código da unidade) para confirmar.";
  }
  if (erro.status === 400 && motivo === "formato") {
    if (campo === "app_id") return "Informe um App ID válido.";
    if (campo === "app_secret") return "Informe o Secret do app.";
    return "Confira os campos informados.";
  }
  const m = erro.mensagem?.trim();
  return m || "Não foi possível concluir.";
}
