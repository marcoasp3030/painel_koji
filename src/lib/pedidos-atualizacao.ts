/** Atualização ao vivo da lista de Pedidos: contagem, pausa e destaque. */

export const INTERVALO_LISTA_MS = 15_000;
export const DESTAQUE_PEDIDO_MS = 6_000;
export const TITULO_NOVO_PEDIDO = "(1) Novo pedido";

export type SinaisContagem = { aguardando: number; andamento: number };

export function totalEmAndamento(em: Record<string, number> | null | undefined) {
  if (!em) return 0;
  return Object.values(em).reduce((s, n) => s + (typeof n === "number" ? n : 0), 0);
}

export function sinaisDaContagem(c: {
  aguardando_loja: { total: number };
  em_andamento: Record<string, number>;
}): SinaisContagem {
  return {
    aguardando: c.aguardando_loja.total,
    andamento: totalEmAndamento(c.em_andamento),
  };
}

/** Mudou o total de aguardando_loja ou a soma de em_andamento. */
export function contagemMudouSinais(antes: SinaisContagem | null, agora: SinaisContagem) {
  if (!antes) return false;
  return antes.aguardando !== agora.aguardando || antes.andamento !== agora.andamento;
}

export function houvePedidoNovo(antes: number | null | undefined, agora: number) {
  return typeof antes === "number" && agora > antes;
}

/**
 * Com diálogo de status ou envio em andamento, a lista não deve “pular”
 * (nem no intervalo de 15 s nem na invalidação pela contagem).
 */
export function devePausarAtualizacaoLista(opts: {
  dialogoStatus: boolean;
  ocupado: boolean;
}) {
  return opts.dialogoStatus || opts.ocupado;
}

/** Troca só a primeira página; as demais (já carregadas) permanecem. */
export function mesclarPrimeiraPagina<T extends { itens: unknown[]; proximo_cursor: number | null }>(
  atual: { pages: T[]; pageParams: unknown[] } | undefined,
  primeira: T,
): { pages: T[]; pageParams: unknown[] } {
  if (!atual || atual.pages.length === 0) {
    return { pages: [primeira], pageParams: [null] };
  }
  return {
    pages: [primeira, ...atual.pages.slice(1)],
    pageParams: [null, ...atual.pageParams.slice(1)],
  };
}
