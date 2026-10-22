/** Cardápio CAT2: edição dos dados do item, prévia de disponibilidade e histórico. */
import { precoTexto, type ItemCardapio, type PedidoCardapio } from "./cardapio";
import type { ResultadoItem } from "./cardapio-ux";

export type CamposItem = Extract<PedidoCardapio, { acao: "editar" }>["campos"];
export type CategoriaItem = { categoria: string; ordem: number; qtd_itens: number };
export type PreviaItem = {
  resumo: string | null;
  disponivel_agora: boolean;
  indisponivel_motivo: string | null;
  data_referencia: string;
};
export type AlteracaoItem = {
  id: number;
  actor: string;
  acao?: string;
  criado_em: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};
export type ServicosCat2 = {
  obter: (id: number) => Promise<ItemCardapio>;
  categorias: (unidade: string, arquivadas?: boolean) => Promise<{ categorias: CategoriaItem[] }>;
  previa: (unidade: string, disponibilidade: CamposItem["disponibilidade"]) => Promise<PreviaItem>;
  historico: (
    id: number,
    cursor?: number,
  ) => Promise<{ itens: AlteracaoItem[]; proximo_cursor: number | null }>;
  /** PATCH com o atualizado_em de `item`, exatamente como foi lido. */
  editar: (item: ItemCardapio, campos: CamposItem) => Promise<ResultadoItem>;
  /** Troca o item na lista em memória (ex.: "Recarregar" depois de um 409). */
  atualizarLocal: (item: ItemCardapio) => void;
};

export const LIMITE_NOME = 120;
export const LIMITE_DESCRICAO = 300;
export const AVISO_SEM_PRECO = "Sem preço, o item sai do cardápio do atendimento.";
export const avisoCategoriaSome = (c: string) => `A categoria ${c} vai deixar de existir.`;

const MOTIVOS: Record<string, string> = {
  esgotado: "esgotado",
  item_inativo: "inativo",
  sem_preco: "sem preço",
  sem_delivery: "sem delivery",
  dia_da_semana: "fora do dia",
  feriado: "feriado",
  horario: "fora do horário",
};
export function motivoItem(m?: string | null) {
  return MOTIVOS[m ?? ""] ?? "";
}

/** "Agora: indisponível · fora do horário", na mesma forma em toda a tela. */
export function situacaoAgora(v: {
  disponivel_agora?: boolean;
  indisponivel_motivo?: string | null;
}) {
  if (typeof v.disponivel_agora !== "boolean") return "Agora: sem informação";
  if (v.disponivel_agora) return "Agora: disponível";
  const m = motivoItem(v.indisponivel_motivo);
  return `Agora: indisponível${m ? ` · ${m}` : ""}`;
}

/** "2026-10-12T22:05-03:00" (fuso da unidade) → "12/10 às 22:05", sem reconverter no navegador. */
export function horaReferencia(s?: string) {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s ?? "");
  return m ? `${m[3]}/${m[2]} às ${m[4]}:${m[5]}` : "";
}

/** Preço digitado em pt-BR ("36,50", "36.5", "36") → número; vazio → null (sem preço). */
export function lerPreco(v: string): number | null {
  const t = v.trim().replace(/^R\$\s*/i, "");
  if (!t) return null;
  if (!/^\d{1,5}([,.]\d{1,2})?$/.test(t))
    throw new Error("Use um preço de até R$ 99.999,99, com no máximo duas casas decimais.");
  const n = Number(t.replace(",", "."));
  if (n <= 0) throw new Error("O preço deve ser maior que zero.");
  return n;
}

/** Valor do campo de preço: 36.5 → "36,50". */
export function precoEditavel(v: number | null) {
  return v === null ? "" : v.toFixed(2).replace(".", ",");
}

/** O que o campo de preço vale agora, em R$, ou o problema dele. */
export function precoDigitado(v: string): { texto: string; erro: boolean } {
  try {
    return { texto: precoTexto(lerPreco(v)), erro: false };
  } catch (e) {
    return { texto: (e as Error).message, erro: true };
  }
}

export type DadosItem = {
  nome: string;
  descricao: string;
  preco: string;
  categoria: string;
  ativo: boolean;
};
export function dadosDe(i: ItemCardapio): DadosItem {
  return {
    nome: i.nome,
    descricao: i.descricao ?? "",
    preco: precoEditavel(i.preco),
    categoria: i.categoria ?? "",
    ativo: i.ativo,
  };
}

/** Só os campos que mudaram em relação ao item lido; erro de preço sobe como exceção. */
export function diferencaItem(base: ItemCardapio, v: DadosItem): CamposItem {
  const c: CamposItem = {};
  const preco = lerPreco(v.preco);
  if (v.nome.trim() !== base.nome) c.nome = v.nome.trim();
  if ((v.descricao.trim() || null) !== (base.descricao?.trim() || null))
    c.descricao = v.descricao.trim() || null;
  if (preco !== base.preco) c.preco = preco;
  if (v.categoria && v.categoria !== (base.categoria ?? "")) c.categoria = v.categoria;
  if (v.ativo !== base.ativo) c.ativo = v.ativo;
  return c;
}

/** A categoria some quando o último item dela sai (ESPEC_CAT2 §6). */
export function categoriaVaiSumir(
  categorias: CategoriaItem[],
  atual: ItemCardapio,
  campos: CamposItem,
) {
  if (!campos.categoria || !atual.categoria || campos.categoria === atual.categoria) return null;
  return categorias.find((c) => c.categoria === atual.categoria)?.qtd_itens === 1
    ? atual.categoria
    : null;
}

/** Ordem do cardápio, com a categoria atual do item sempre presente no seletor. */
export function opcoesCategoria(categorias: CategoriaItem[], atual: string | null) {
  const nomes = [...categorias].sort((a, b) => a.ordem - b.ordem).map((c) => c.categoria);
  return atual && !nomes.includes(atual) ? [atual, ...nomes] : nomes;
}

export const NOMES_CAMPO: Record<string, string> = {
  nome: "Nome",
  descricao: "Descrição",
  preco: "Preço",
  ativo: "Ativo",
  categoria: "Categoria",
  disponibilidade: "Disponibilidade",
};
/** Valor do histórico em palavras: R$, sim/não, resumo da regra. */
export function valorHistorico(campo: string, v: unknown): string {
  if (v === undefined) return "—";
  if (campo === "preco") return precoTexto(v === null ? null : Number(v));
  if (campo === "ativo") return v ? "Sim" : "Não";
  if (campo === "disponibilidade") {
    if (v === null) return "Sempre disponível";
    const d = v as { resumo?: string | null };
    return d.resumo || "Regra de disponibilidade";
  }
  if (v === null || v === "") return "(vazio)";
  return typeof v === "string" ? v : JSON.stringify(v);
}
/** Campos que mudaram numa linha do histórico. */
export function camposAlterados(h: AlteracaoItem) {
  const antes = h.antes ?? {};
  const depois = h.depois ?? {};
  return [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
    .filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
    .map((k) => ({
      campo: k,
      nome: NOMES_CAMPO[k] ?? k,
      antes: valorHistorico(k, antes[k]),
      depois: valorHistorico(k, depois[k]),
    }));
}
/** criado_em vem com fuso; mostrado no horário de Brasília. */
export function dataHistorico(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
