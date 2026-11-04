/** Regras da página do cardápio do cliente. O servidor confere tudo de novo ao fechar: aqui é para mostrar o valor certo. */
export type Opcao = {
  opcao_id: number;
  nome: string;
  preco_extra: number | null;
  disponivel: boolean;
};
export type Grupo = {
  grupo_id: number;
  nome: string;
  obrigatorio: boolean;
  minimo: number;
  maximo: number;
  repetir: boolean;
  opcoes: Opcao[];
};
export type ItemCardapio = {
  item_id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  alcoolico: boolean;
  disponivel: boolean;
  aviso: string | null;
  grupos: Grupo[];
};
export type Categoria = { nome: string; itens: ItemCardapio[] };
export type FormaPagamento = { codigo: string; rotulo: string; aceita_troco: boolean };
export type UnidadeCardapio = {
  codigo: string;
  nome: string;
  endereco: string | null;
  aberta_agora: boolean | null;
  proxima_abertura: string | null;
  aceita_retirada: boolean;
  faz_entrega: boolean;
  taxa_entrega: number | null;
  /** A taxa depende do endereço: a página consulta o gateway depois que o cliente informa. */
  taxa_por_area: boolean;
  frete_gratis_acima: number | null;
  pedido_minimo: number | null;
  formas: FormaPagamento[];
};
export type CotacaoTaxa = {
  atende: boolean;
  motivo: "fora_area" | "bairro_nao_reconhecido" | "falta_cep" | "delivery_indisponivel" | null;
  taxa: number | null;
  origem: string | null;
  pedir: "cep" | "confirmar_bairro" | null;
};
export type Escolha = { grupo_id: number; opcao_id: number; quantidade: number };
/** Linha do pedido. O preço não fica aqui: é sempre lido do cardápio, para não mostrar valor velho. */
export type Linha = {
  chave: string;
  item_id: number;
  quantidade: number;
  observacao: string;
  opcoes: Escolha[];
};

export const MAX_QUANTIDADE = 99;

export const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const paraBusca = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Linhas iguais somam; mudar opção ou observação cria outra linha. */
export function chaveDaLinha(itemId: number, opcoes: readonly Escolha[], observacao: string) {
  const escolhas = [...opcoes]
    .sort((a, b) => a.grupo_id - b.grupo_id || a.opcao_id - b.opcao_id)
    .map((o) => `${o.grupo_id}:${o.opcao_id}x${o.quantidade}`)
    .join(",");
  return `${itemId}|${escolhas}|${observacao.trim()}`;
}

export function novaLinha(
  itemId: number,
  quantidade: number,
  opcoes: Escolha[],
  observacao: string,
): Linha {
  return {
    chave: chaveDaLinha(itemId, opcoes, observacao),
    item_id: itemId,
    quantidade,
    observacao: observacao.trim(),
    opcoes,
  };
}

export function somarLinha(linhas: readonly Linha[], nova: Linha) {
  const igual = linhas.find((l) => l.chave === nova.chave);
  if (!igual) return [...linhas, nova];
  return linhas.map((l) =>
    l === igual
      ? { ...l, quantidade: Math.min(MAX_QUANTIDADE, l.quantidade + nova.quantidade) }
      : l,
  );
}

export function mudarQuantidade(linhas: readonly Linha[], chave: string, quantidade: number) {
  return quantidade <= 0
    ? linhas.filter((l) => l.chave !== chave)
    : linhas.map((l) =>
        l.chave === chave ? { ...l, quantidade: Math.min(MAX_QUANTIDADE, quantidade) } : l,
      );
}

export function mapaDeItens(categorias: readonly Categoria[]) {
  return new Map(categorias.flatMap((c) => c.itens.map((i) => [i.item_id, i] as const)));
}

/** Preço de uma unidade com as escolhas. */
export function precoUnitario(item: ItemCardapio, opcoes: readonly Escolha[]) {
  let extras = 0;
  for (const e of opcoes) {
    const grupo = item.grupos.find((g) => g.grupo_id === e.grupo_id);
    const opcao = grupo?.opcoes.find((o) => o.opcao_id === e.opcao_id);
    extras += (opcao?.preco_extra ?? 0) * e.quantidade;
  }
  return item.preco + extras;
}

export function nomesDasEscolhas(item: ItemCardapio, opcoes: readonly Escolha[]) {
  return opcoes.flatMap((e) => {
    const opcao = item.grupos
      .find((g) => g.grupo_id === e.grupo_id)
      ?.opcoes.find((o) => o.opcao_id === e.opcao_id);
    if (!opcao) return [];
    return [e.quantidade > 1 ? `${e.quantidade}× ${opcao.nome}` : opcao.nome];
  });
}

const qtdNoGrupo = (grupo: Grupo, opcoes: readonly Escolha[]) =>
  opcoes.filter((e) => e.grupo_id === grupo.grupo_id).reduce((s, e) => s + e.quantidade, 0);

/** A primeira pendência das escolhas, em palavras; null quando dá para adicionar. */
export function faltaNasEscolhas(item: ItemCardapio, opcoes: readonly Escolha[]) {
  for (const g of item.grupos) {
    const n = qtdNoGrupo(g, opcoes);
    if (n < g.minimo)
      return g.minimo === 1 ? `Escolha: ${g.nome}` : `Escolha ${g.minimo} em ${g.nome}`;
    if (n > g.maximo) return `No máximo ${g.maximo} em ${g.nome}`;
  }
  return null;
}

/** Toque numa opção: em escolha única troca; nas demais liga e desliga, respeitando o máximo. */
export function alternarOpcao(grupo: Grupo, opcoes: readonly Escolha[], opcaoId: number) {
  const fora = opcoes.filter((e) => e.grupo_id !== grupo.grupo_id);
  const doGrupo = opcoes.filter((e) => e.grupo_id === grupo.grupo_id);
  if (grupo.maximo === 1) {
    const ligada = doGrupo.some((e) => e.opcao_id === opcaoId);
    if (ligada && grupo.minimo === 0) return fora;
    return [...fora, { grupo_id: grupo.grupo_id, opcao_id: opcaoId, quantidade: 1 }];
  }
  if (doGrupo.some((e) => e.opcao_id === opcaoId))
    return opcoes.filter((e) => !(e.grupo_id === grupo.grupo_id && e.opcao_id === opcaoId));
  if (qtdNoGrupo(grupo, opcoes) >= grupo.maximo) return [...opcoes];
  return [...opcoes, { grupo_id: grupo.grupo_id, opcao_id: opcaoId, quantidade: 1 }];
}

/** Grupo em que a mesma opção pode vir mais de uma vez: muda a quantidade em vez de marcar. */
export function ajustarRepeticao(
  grupo: Grupo,
  opcoes: readonly Escolha[],
  opcaoId: number,
  delta: number,
) {
  const atual =
    opcoes.find((e) => e.grupo_id === grupo.grupo_id && e.opcao_id === opcaoId)?.quantidade ?? 0;
  if (delta > 0 && qtdNoGrupo(grupo, opcoes) >= grupo.maximo) return [...opcoes];
  const nova = Math.max(0, atual + delta);
  const resto = opcoes.filter((e) => !(e.grupo_id === grupo.grupo_id && e.opcao_id === opcaoId));
  return nova
    ? [...resto, { grupo_id: grupo.grupo_id, opcao_id: opcaoId, quantidade: nova }]
    : resto;
}

export function resumoDoPedido(
  linhas: readonly Linha[],
  categorias: readonly Categoria[],
  taxaEntrega: number | null,
) {
  const itens = mapaDeItens(categorias);
  let subtotal = 0;
  let quantidade = 0;
  let alcoolico = false;
  const fora: Linha[] = [];
  for (const l of linhas) {
    const item = itens.get(l.item_id);
    if (!item || !item.disponivel) {
      fora.push(l);
      continue;
    }
    subtotal += precoUnitario(item, l.opcoes) * l.quantidade;
    quantidade += l.quantidade;
    alcoolico ||= item.alcoolico;
  }
  // Soma em centavos: o total vai ao servidor para conferir, e erro de ponto flutuante viraria recusa falsa.
  const redondo = (v: number) => Math.round(v * 100) / 100;
  return {
    subtotal: redondo(subtotal),
    taxa: taxaEntrega ?? 0,
    total: redondo(subtotal + (taxaEntrega ?? 0)),
    quantidade,
    alcoolico,
    fora,
  };
}

export function filtrarCategorias(categorias: readonly Categoria[], busca: string) {
  const termo = paraBusca(busca).trim();
  if (!termo) return [...categorias];
  return categorias.flatMap((c) => {
    const itens = c.itens.filter((i) =>
      paraBusca(`${i.nome} ${i.descricao ?? ""}`).includes(termo),
    );
    return itens.length ? [{ ...c, itens }] : [];
  });
}

/** Abertura em palavras curtas. "Hoje" e "amanhã" valem no fuso que veio do servidor, não no do aparelho. */
export function textoAbertura(iso: string | null, agora = Date.now()) {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}).*?(Z|[+-]\d{2}:\d{2})?$/.exec(iso);
  if (!m) return null;
  const [, dia, hh, mm, fuso] = m;
  const sinal = fuso?.startsWith("-") ? -1 : 1;
  const [fh = 0, fm = 0] = (fuso && fuso !== "Z" ? fuso.slice(1).split(":") : []).map(Number);
  const local = agora + sinal * (fh * 60 + fm) * 60_000;
  const diaEm = (t: number) => new Date(t).toISOString().slice(0, 10);
  const hora = `${hh}h${mm === "00" ? "" : mm}`;
  if (dia === diaEm(local)) return `hoje às ${hora}`;
  if (dia === diaEm(local + 86_400_000)) return `amanhã às ${hora}`;
  return `${dia!.slice(8, 10)}/${dia!.slice(5, 7)} às ${hora}`;
}

/** Sem horário cadastrado (null) não dá para afirmar que está fechada. Pedido já agendado na conversa segue valendo. */
export function unidadeLiberada(u: Pick<UnidadeCardapio, "aberta_agora">, agendado: boolean) {
  return u.aberta_agora !== false || agendado;
}

/** A abertura mais próxima entre as unidades fechadas. */
export function proximaAbertura(unidades: readonly Pick<UnidadeCardapio, "proxima_abertura">[]) {
  return (
    unidades
      .flatMap((u) => (u.proxima_abertura ? [u.proxima_abertura] : []))
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
  );
}

export type Endereco = {
  cep: string;
  rua: string;
  numero: string;
  semNumero: boolean;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
};

export const ENDERECO_VAZIO: Endereco = {
  cep: "",
  rua: "",
  numero: "",
  semNumero: false,
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  referencia: "",
};

export const soDigitosCep = (valor: string) => valor.replace(/\D/g, "").slice(0, 8);

export function mascaraCep(valor: string) {
  const d = soDigitosCep(valor);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Frete grátis acima do valor da unidade. Sem valor conhecido, nada a zerar: a unidade confirma. */
export function taxaFinal(taxa: number | null, freteGratisAcima: number | null, subtotal: number) {
  if (taxa === null) return null;
  return freteGratisAcima !== null && subtotal >= freteGratisAcima ? 0 : taxa;
}

/** O que ainda impede a entrega neste endereço; null quando a taxa já é conhecida. */
export function pendenciaDaArea(c: CotacaoTaxa | null, confirmado: boolean) {
  if (!c) return "Informe o endereço para calcular a taxa";
  if (c.motivo === "fora_area") return "Não entregamos neste endereço";
  if (c.motivo === "falta_cep" || c.pedir === "cep") return "Informe o CEP";
  if (c.pedir === "confirmar_bairro" && !confirmado) return "Confirme o bairro";
  return null;
}

/** O que falta para o entregador achar o endereço, em palavras; null quando está completo. */
export function faltaNoEndereco(e: Endereco) {
  if (!e.rua.trim()) return "Informe a rua";
  if (!e.semNumero && !e.numero.trim()) return "Informe o número";
  if (!e.bairro.trim()) return "Informe o bairro";
  if (!e.cidade.trim()) return "Informe a cidade";
  return null;
}

/** Uma linha só: é assim que o endereço chega à unidade e ao agente. */
export function montarEndereco(e: Endereco) {
  const numero = e.semNumero ? "s/n" : e.numero.trim();
  const cidade = [e.cidade.trim(), e.uf.trim().toUpperCase()].filter(Boolean).join("/");
  const partes = [
    `${e.rua.trim()}, ${numero}`,
    e.complemento.trim(),
    e.bairro.trim(),
    cidade,
    e.cep ? `CEP ${mascaraCep(e.cep)}` : "",
  ].filter(Boolean);
  const referencia = e.referencia.trim();
  return `${partes.join(" - ")}${referencia ? `. Referência: ${referencia}` : ""}`.slice(0, 500);
}

/** Texto do botão "Fazer outro pedido" no link da conversa (uso único). */
export const TEXTO_NOVO_LINK_CONVERSA = "Peça um novo link na conversa";

/**
 * Depois de "Fazer outro pedido" no link da loja: pedido vazio e, se houver várias unidades,
 * volta à escolha; com uma só, mantém essa unidade.
 */
export function depoisDeOutroPedidoLoja(unidades: Pick<UnidadeCardapio, "codigo">[]) {
  return {
    linhas: [] as Linha[],
    unidade: unidades.length === 1 ? (unidades[0]?.codigo ?? null) : null,
    limparRascunho: true as const,
  };
}

/** Só o link da loja reabre o cardápio; o da conversa pede um link novo. */
export function outroPedidoVoltaAoCardapio(loja: boolean) {
  return loja;
}

/**
 * Gateway devolve `repetido: true` quando o link da conversa já foi usado:
 * o número é do pedido anterior e nada novo foi gravado — não é sucesso.
 */
export function respostaDePedidoEhRepetida(dados: { repetido?: unknown } | null | undefined) {
  return dados?.repetido === true;
}

export function textoLinkJaUsado(numero: string) {
  return `Este link já foi usado no pedido nº ${numero}. Peça um novo link na conversa para fazer outro pedido.`;
}

/** Link wa.me quando a página tem o número da loja; senão null (só o texto). */
export function whatsappDaConversa(numero: string | null | undefined) {
  const digitos = (numero ?? "").replace(/\D/g, "");
  return digitos.length >= 10 ? `https://wa.me/${digitos}` : null;
}

const MENSAGEM_RECUSA: Record<string, string> = {
  fora_area: "Não entregamos neste endereço. Escolha retirada ou outro endereço.",
  bairro_nao_reconhecido: "Não encontramos este bairro. Confira o endereço.",
  falta_cep: "Informe o CEP para calcular a taxa.",
  whatsapp_indisponivel:
    "O WhatsApp da loja não está disponível agora. Tente de novo em instantes.",
  codigo_expirado: "O tempo para enviar a mensagem acabou. Volte ao pedido e finalize de novo.",
  codigo_invalido: "Não encontramos este pedido. Volte e finalize de novo.",
  link_invalido: "Este link não é válido. Peça um novo na conversa.",
  link_expirado: "Este link expirou. Peça um novo na conversa.",
  muitas_chamadas: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
  previa: "Esta é uma prévia: o pedido não é enviado.",
  preco_alterado: "Um preço mudou. Confira o novo total antes de enviar.",
  falta_endereco: "Informe o endereço de entrega.",
  falta_maioridade: "Confirme que você tem 18 anos ou mais para pedir bebida alcoólica.",
  abaixo_do_minimo: "O pedido está abaixo do valor mínimo desta unidade.",
  unidade_fechada: "A unidade fechou enquanto você montava o pedido.",
  item_indisponivel: "Um item ficou indisponível. Confira o pedido.",
  item_inativo: "Um item saiu do cardápio. Confira o pedido.",
  item_inexistente: "Um item saiu do cardápio. Confira o pedido.",
  sem_preco: "Um item está sem preço agora. Tire-o do pedido.",
  sem_delivery: "Um item não está disponível para pedido. Tire-o do pedido.",
  opcao_inexistente: "Uma opção saiu do cardápio. Monte o item de novo.",
  opcao_obrigatoria: "Falta escolher uma opção obrigatória de um item.",
  opcoes_abaixo_do_minimo: "Falta escolher uma opção de um item.",
  opcoes_acima_do_maximo: "Há opções demais em um item.",
  forma_pagamento_invalida: "Esta forma de pagamento não está disponível. Escolha outra.",
  pagamento_nao_informado: "Escolha a forma de pagamento.",
  troco_menor_que_total: "O valor para troco precisa ser maior que o total.",
  troco_so_em_dinheiro: "Troco só existe no pagamento em dinheiro.",
  retirada_indisponivel: "Esta unidade não aceita retirada.",
  delivery_indisponivel: "Esta unidade não faz entrega.",
  horario_passado: "O horário combinado já passou. Fale com o atendente.",
  horario_fora_funcionamento: "O horário combinado não é de funcionamento. Fale com o atendente.",
};

/** Os textos do servidor são para o agente: ao cliente vão estes. */
export function textoRecusa(motivo: string | null | undefined) {
  return (
    MENSAGEM_RECUSA[motivo ?? ""] ?? "Não foi possível enviar agora. Tente de novo em instantes."
  );
}
