/**
 * 99FOOD1-b: pedidos da 99Food (só leitura) e bloco na Visão de vendas.
 * order_id é texto de até 64 bits — nunca converter com Number().
 */

export const INTERVALO_PEDIDOS_FOOD99_MS = 15_000;

export const TEXTO_CONFIRMACAO_FOOD99 =
  "A confirmação do pedido é feita no app da 99Food (até 5 minutos).";

/** Status do gateway → português (contrato ESPEC §11). */
export const ROTULO_STATUS_FOOD99: Record<string, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  pronto: "Pronto",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const ROTULO_ENTREGA_FOOD99: Record<string, string> = {
  entrega_99: "Entrega 99",
  entrega_loja: "Entrega da loja",
};

export const ROTULO_PAGAMENTO_FOOD99: Record<string, string> = {
  online: "Pago online",
  dinheiro: "Dinheiro",
  cartao_na_entrega: "Cartão na entrega",
  carteira_99: "Carteira 99",
  nao_informado: "Não informado",
};

export type PedidoFood99Lista = {
  /** Sempre texto — ids de 64 bits quebram se virarem number. */
  order_id: string;
  numero: string | null;
  loja: string;
  unidade: string | null;
  status: string;
  teste: boolean;
  criado_em: string;
  tipo_entrega: string | null;
  total: number | null;
  pagamento: string | null;
  detalhado: boolean;
  numero_itens: number;
};

export type PedidoFood99Item = {
  nome: string | null;
  quantidade: number | null;
  total: number | null;
  /** Na 99 as opções vêm como nomes (texto). */
  opcoes?: string[];
};

export type PedidoFood99Evento = {
  tipo: string;
  recebido_em: string | null;
};

export type PedidoFood99Detalhe = PedidoFood99Lista & {
  subtotal: number | null;
  taxa_entrega: number | null;
  descontos: number | null;
  total_pago: number | null;
  itens: PedidoFood99Item[];
  eventos: PedidoFood99Evento[];
};

export type ListaPedidosFood99 = {
  itens: PedidoFood99Lista[];
  /** Há mais páginas; use o criado_em do último item em `antes`. */
  mais: boolean;
};

export type ResultadoAtualizarFood99 = { atualizados: number };

export type ResumoFood99Indicadores = {
  pedidos: number;
  faturamento: number;
  ticket_medio: number;
  cancelados: number;
  aguardando: number;
  recebidos: number;
};

export type BlocoFood99Indicadores = {
  resumo: ResumoFood99Indicadores;
  anterior: ResumoFood99Indicadores;
  variacao_pct: {
    faturamento: number | null;
    pedidos: number | null;
    ticket_medio: number | null;
  };
  evolucao: { inicio: string; pedidos: number; faturamento: number }[];
  produtos: { nome: string; quantidade: number; faturamento: number }[];
};

/** Garante order_id como texto; rejeita número inseguro (já corrompido). */
export function orderIdFood99ComoTexto(v: unknown): string | null {
  if (typeof v === "string" && /^[0-9]{1,30}$/.test(v)) return v;
  // Só aceita number se couber em safe integer (senão a precisão já se perdeu).
  if (typeof v === "number" && Number.isSafeInteger(v) && v > 0) return String(v);
  return null;
}

export function rotuloStatusFood99(status: string | null | undefined): string {
  if (!status) return "—";
  return ROTULO_STATUS_FOOD99[status] ?? status;
}

export function rotuloEntregaFood99(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return ROTULO_ENTREGA_FOOD99[tipo] ?? tipo;
}

export function rotuloPagamentoFood99(pag: string | null | undefined): string {
  if (!pag) return "—";
  return ROTULO_PAGAMENTO_FOOD99[pag] ?? pag;
}

export function deveMostrarBlocoFood99(
  bloco: BlocoFood99Indicadores | null | undefined,
): bloco is BlocoFood99Indicadores {
  return bloco != null;
}

export function pedidoFood99Pendente(p: Pick<PedidoFood99Lista, "detalhado">): boolean {
  return !p.detalhado;
}

/** Cursor da próxima página: criado_em do último item quando `mais`. */
export function antesProximaPaginaFood99(lista: ListaPedidosFood99): string | undefined {
  if (!lista.mais || lista.itens.length === 0) return undefined;
  return lista.itens[lista.itens.length - 1]!.criado_em;
}

export function filtrosListaFood99(opts: {
  de?: string;
  ate?: string;
  status?: string;
  unidade?: string;
  teste?: boolean | null;
  limite?: number;
  antes?: string | null;
}) {
  return {
    ...(opts.de ? { de: opts.de } : {}),
    ...(opts.ate ? { ate: opts.ate } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.unidade ? { unidade: opts.unidade } : {}),
    ...(opts.teste === true || opts.teste === false ? { teste: opts.teste } : {}),
    ...(opts.limite != null ? { limite: opts.limite } : {}),
    ...(opts.antes ? { antes: opts.antes } : {}),
  };
}
