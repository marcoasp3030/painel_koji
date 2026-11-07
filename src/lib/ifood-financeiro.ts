/** IFOOD1-b2: financeiro do iFood (só leitura) — resumo, repasses, coleta. */

export type ResumoFinanceiroIfood = {
  creditos: number;
  debitos: number;
  repasse_liquido: number;
  recebido_direto: number;
  pedidos: number;
  eventos: number;
};

export type TipoEventoFinanceiro = {
  nome: string;
  descricao: string | null;
  eventos: number;
  valor: number;
  com_repasse: boolean;
};

export type DiaFinanceiroIfood = {
  data: string;
  creditos: number;
  debitos: number;
  repasse: number;
};

export type FormaPagamentoFinanceiro = {
  forma: string;
  bandeira: string | null;
  valor: number;
  eventos: number;
};

export type AReceberFinanceiro = {
  total: number;
  por_data: { data: string; valor: number }[];
};

export type TituloRepasseIfood = {
  titulo: string;
  loja: string;
  tipo: string | null;
  produto: string | null;
  valor: number;
  status: string | null;
  pagamento_em: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
};

export type RepassesFinanceiroIfood = {
  pago: number;
  pendente: number;
  retido_recebiveis: number;
  boletos: number;
  renegociado: number;
  itens: TituloRepasseIfood[];
};

export type ColetaFinanceiroIfood = {
  loja: string;
  nome: string | null;
  sucesso_em: string | null;
  erro: string | null;
  coletando: boolean;
  coletado_desde: string | null;
};

export type FinanceiroIfood = {
  periodo: { de: string; ate: string };
  resumo: ResumoFinanceiroIfood;
  por_tipo: TipoEventoFinanceiro[];
  por_dia: DiaFinanceiroIfood[];
  por_forma: FormaPagamentoFinanceiro[];
  a_receber: AReceberFinanceiro;
  repasses: RepassesFinanceiroIfood;
  coletas: ColetaFinanceiroIfood[];
};

export type ResultadoAtualizarFinanceiro = { coletando: number };

/** Linha do financeiro no detalhe do pedido iFood. */
export type LinhaFinanceiroPedido = {
  nome: string;
  descricao: string | null;
  valor: number;
  com_repasse: boolean;
  taxa_pct: number | null;
  pagamento_previsto: string | null;
};

export const ROTULO_TIPO_REPASSE: Record<string, string> = {
  REPASSE: "Repasse",
  REGISTRO_RECEBIVEIS: "Retido (recebíveis)",
  BOLETO: "Boleto",
  RENEGOCIADA: "Renegociado",
};

export const ROTULO_STATUS_REPASSE: Record<string, string> = {
  SUCCEED: "Pago",
  PENDING: "Pendente",
  FAILED: "Falhou",
};

export const CARTOES_RESUMO = [
  { chave: "creditos" as const, rotulo: "Vendas / créditos" },
  { chave: "debitos" as const, rotulo: "Comissões e taxas" },
  { chave: "repasse_liquido" as const, rotulo: "Repasse líquido" },
  { chave: "recebido_direto" as const, rotulo: "Recebido direto pela loja" },
];

export function rotuloTipoRepasse(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return ROTULO_TIPO_REPASSE[tipo] ?? tipo;
}

export function rotuloStatusRepasse(status: string | null | undefined): string {
  if (!status) return "—";
  return ROTULO_STATUS_REPASSE[status] ?? status;
}

/** Mensagem amigável do erro de coleta do gateway. */
export function mensagemErroColeta(erro: string | null | undefined): string | null {
  if (!erro) return null;
  if (erro === "sem_permissao") {
    return "A loja não deu acesso ao financeiro para o aplicativo";
  }
  return "iFood indisponível";
}

export function algumaColetando(coletas: ColetaFinanceiroIfood[]): boolean {
  return coletas.some((c) => c.coletando);
}

export function temFinanceiroPedido(
  linhas: LinhaFinanceiroPedido[] | null | undefined,
): linhas is LinhaFinanceiroPedido[] {
  return Array.isArray(linhas) && linhas.length > 0;
}

export function filtrosFinanceiroIfood(opts: { de?: string; ate?: string; loja?: string }) {
  return {
    ...(opts.de ? { de: opts.de } : {}),
    ...(opts.ate ? { ate: opts.ate } : {}),
    ...(opts.loja ? { loja: opts.loja } : {}),
  };
}
