/** IFOOD1-a: lojas do iFood — plataforma liga/desliga; gestor vê e confere. */

export type SituacaoIfood = "conectada" | "sem_permissao" | "desligada";

export type LojaAutorizadaIfood = {
  merchant_id: string;
  nome: string | null;
  razao_social: string | null;
  ligada_a: { tenant_id: string; unidade: string | null; ativo: boolean } | null;
};

export type LojaEmpresaIfood = {
  merchant_id: string;
  nome: string | null;
  unidade: string | null;
  ativo: boolean;
  situacao: SituacaoIfood;
  conferida_em: string | null;
  ligado_em: string | null;
  ligado_por: string | null;
};

export type ListaLojasEmpresaIfood = {
  configurado: boolean;
  itens: LojaEmpresaIfood[];
};

/** Só a plataforma lista lojas autorizadas e liga/desliga. */
export function podeGerirLojasIfood(papel: string | null | undefined) {
  return papel === "plataforma";
}

/** Gestor e plataforma veem as lojas da empresa e conferem. */
export function podeVerLojasIfoodEmpresa(papel: string | null | undefined) {
  return papel === "plataforma" || papel === "gestor";
}

export function rotuloSituacaoIfood(s: SituacaoIfood | string) {
  if (s === "conectada") return "Conectada";
  if (s === "sem_permissao") return "Sem permissão";
  if (s === "desligada") return "Desligada";
  return s;
}

/** Texto da coluna "ligada a": empresa/unidade ou "livre". */
export function textoLigadaA(
  ligada: LojaAutorizadaIfood["ligada_a"],
  nomeEmpresa: string | null | undefined,
): string {
  if (!ligada) return "livre";
  const empresa = nomeEmpresa?.trim() || ligada.tenant_id;
  const unidade = ligada.unidade?.trim();
  const base = unidade ? `${empresa} · ${unidade}` : empresa;
  return ligada.ativo ? base : `${base} (inativa)`;
}

/** Nome digitado para desligar: igual ao nome da loja, ou ao merchant_id se não houver nome. */
export function confirmacaoDesligarIfoodConfere(
  digitado: string,
  loja: { nome: string | null; merchant_id: string },
) {
  const t = digitado.trim();
  if (!t) return false;
  const nome = (loja.nome || "").trim();
  return t === nome || t === loja.merchant_id;
}

export function nomeParaConfirmacaoDesligar(loja: { nome: string | null; merchant_id: string }) {
  const nome = (loja.nome || "").trim();
  return nome || loja.merchant_id;
}

/**
 * Mensagem para a tela: usa erro.mensagem; 503 nao_configurado vira o texto fixo do contrato PAINEL.
 */
export function mensagemErroIfood(erro: {
  mensagem?: string | null;
  status?: number;
  detalhes?: Record<string, unknown> | null;
}): string {
  if (erro.status === 503 && erro.detalhes?.["motivo"] === "nao_configurado") {
    return "integração não configurada no gateway";
  }
  const m = erro.mensagem?.trim();
  return m || "Não foi possível concluir.";
}

export const TEXTO_SEM_LOJA_EMPRESA =
  "A loja autoriza o aplicativo da Ticway no Portal do Parceiro do iFood. Depois disso, a Ticway faz a ligação à empresa.";

export const TEXTO_CONFIRMACAO_DESLIGAR_IFOOD =
  "Desliga a loja desta empresa e apaga os dados guardados dela no gateway. Digite o nome da loja para confirmar.";
