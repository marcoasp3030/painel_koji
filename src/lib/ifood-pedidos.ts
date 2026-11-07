/** IFOOD1-b1: pedidos do iFood (só leitura) e bloco na Visão de vendas. */

export const INTERVALO_PEDIDOS_IFOOD_MS = 15_000;

export const TEXTO_ACOMPANHAMENTO_IFOOD =
  "Os pedidos do iFood são aceitos e despachados no sistema do iFood; aqui é só acompanhamento.";

/** Status do iFood → português (contrato PAINEL). */
export const ROTULO_STATUS_IFOOD: Record<string, string> = {
  PLACED: "Novo",
  CONFIRMED: "Confirmado",
  SEPARATION_STARTED: "Confirmado",
  SEPARATION_ENDED: "Confirmado",
  READY_TO_PICKUP: "Pronto",
  DISPATCHED: "Saiu para entrega",
  CONCLUDED: "Concluído",
  CANCELLED: "Cancelado",
};

export type StatusIfoodPedido = keyof typeof ROTULO_STATUS_IFOOD | string;

export type PedidoIfoodLista = {
  order_id: string;
  numero: string | null;
  loja: string;
  status: string;
  teste: boolean;
  criado_em: string;
  tipo: string | null;
  canal_venda: string | null;
  total: number | null;
  cliente_nome: string | null;
  bairro: string | null;
  detalhado: boolean;
  numero_itens: number;
};

export type PedidoIfoodItem = {
  nome: string | null;
  codigo?: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  total: number | null;
  opcoes?: { nome: string | null; quantidade: number | null; preco: number | null }[];
};

export type PedidoIfoodPagamento = {
  forma: string | null;
  tipo: string | null;
  valor: number | null;
  bandeira: string | null;
};

export type PedidoIfoodEvento = {
  codigo: string;
  criado_em: string | null;
  recebido_em?: string | null;
};

export type PedidoIfoodDetalhe = PedidoIfoodLista & {
  momento: string | null;
  categoria: string | null;
  subtotal: number | null;
  taxa_entrega: number | null;
  descontos: number | null;
  taxas_adicionais: number | null;
  itens: PedidoIfoodItem[];
  pagamentos: PedidoIfoodPagamento[];
  eventos: PedidoIfoodEvento[];
  /** IFOOD1-b2: créditos/débitos do iFood neste pedido (quando já coletado). */
  financeiro?: import("./ifood-financeiro").LinhaFinanceiroPedido[];
};

export type ListaPedidosIfood = {
  itens: PedidoIfoodLista[];
  proximo_antes: string | null;
};

export type ResultadoAtualizarIfood = { detalhados: number; pendentes: number };

export type ResumoIfoodIndicadores = {
  pedidos: number;
  faturamento: number;
  ticket_medio: number;
  clientes: number;
  cancelados: number;
  aguardando: number;
  recebidos: number;
};

export type BlocoIfoodIndicadores = {
  resumo: ResumoIfoodIndicadores;
  anterior: ResumoIfoodIndicadores;
  variacao_pct: {
    faturamento: number | null;
    pedidos: number | null;
    ticket_medio: number | null;
  };
  evolucao: { inicio: string; pedidos: number; faturamento: number }[];
  produtos: { nome: string; quantidade: number; faturamento: number }[];
};

export function rotuloStatusIfood(status: string | null | undefined): string {
  if (!status) return "—";
  return ROTULO_STATUS_IFOOD[status] ?? status;
}

export function deveMostrarBlocoIfood(
  ifood: BlocoIfoodIndicadores | null | undefined,
): ifood is BlocoIfoodIndicadores {
  return ifood != null;
}

export function pedidoIfoodPendente(p: Pick<PedidoIfoodLista, "detalhado">): boolean {
  return !p.detalhado;
}

export function filtrosListaIfood(opts: {
  de?: string;
  ate?: string;
  status?: string[];
  loja?: string;
  teste?: boolean | null;
  limite?: number;
  antes?: string | null;
}) {
  return {
    ...(opts.de ? { de: opts.de } : {}),
    ...(opts.ate ? { ate: opts.ate } : {}),
    ...(opts.status?.length ? { status: opts.status.join(",") } : {}),
    ...(opts.loja ? { loja: opts.loja } : {}),
    ...(opts.teste === true || opts.teste === false ? { teste: opts.teste } : {}),
    ...(opts.limite != null ? { limite: opts.limite } : {}),
    ...(opts.antes ? { antes: opts.antes } : {}),
  };
}
