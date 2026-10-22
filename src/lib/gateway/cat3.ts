import { z } from "zod";
import { disponibilidadeSchema, type ItemCardapio } from "./cardapio";
const id = z.number().int().positive();
const unidade = z.string().min(1).max(40);
const ids = z
  .array(id)
  .min(1)
  .max(500)
  .refine((v) => new Set(v).size === v.length, "Seleção repetida.");
const empresa = z
  .string()
  .regex(/^[a-z0-9_]{3,40}$/)
  .nullish();
export const cat3Schema = z.discriminatedUnion("acao", [
  z
    .object({
      empresa,
      acao: z.literal("criar"),
      campos: z
        .object({
          unidade,
          categoria_id: id,
          nome: z.string().trim().min(1).max(120),
          descricao: z.string().max(300).nullable(),
          preco: z.number().positive().nullable(),
          codigo: z
            .string()
            .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/)
            .optional(),
          tipo: z.enum(["item", "adicional", "opcao_executivo", "regra"]),
          alcoolico: z.boolean(),
          delivery: z.enum(["sim", "nao", "a_confirmar"]),
          ativo: z.boolean(),
          observacao: z.string().max(300).nullable(),
          disponibilidade: disponibilidadeSchema.nullable(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("item"),
      id,
      operacao: z.enum(["esgotar", "repor", "arquivar", "desarquivar", "duplicar"]),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("categoria_criar"),
      unidade,
      nome: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("categoria_renomear"),
      id,
      nome: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("categoria_arquivar"),
      id,
      itens: z.enum(["arquivar", "mover"]),
      destino: id.optional(),
    })
    .strict(),
  z.object({ empresa, acao: z.literal("ordenar_categorias"), unidade, categorias: ids }).strict(),
  z.object({ empresa, acao: z.literal("ordenar_itens"), id, itens: ids }).strict(),
  z
    .object({
      empresa,
      acao: z.literal("copiar"),
      itens: ids,
      destino: unidade,
      ligar: z.boolean(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("lote"),
      itens: ids,
      operacao: z.enum([
        "reajustar",
        "mover",
        "pausar",
        "ativar",
        "esgotar",
        "repor",
        "arquivar",
        "desarquivar",
      ]),
      simulacao: z.boolean(),
      percentual: z.number().min(-90).max(500).optional(),
      valor: z.number().finite().optional(),
      categoria_id: id.optional(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("sugestoes"),
      ignoradas: z.boolean(),
      cursor: z.string().max(300).optional(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("ligar"),
      grupos: z
        .array(z.object({ chave: z.string().min(1).max(300), itens: ids.optional() }).strict())
        .min(1)
        .max(400),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("sugestoes_acao"),
      operacao: z.enum(["ignorar", "restaurar"]),
      chaves: z.array(z.string().min(1).max(300)).min(1).max(400),
    })
    .strict(),
]);
export type PedidoCat3 = z.input<typeof cat3Schema>;
export type CategoriaCat3 = {
  id: number;
  nome: string;
  categoria: string;
  ordem: number;
  posicao: number | null;
  qtd_itens: number;
  arquivada: boolean;
};
export type LinhaResultado = {
  item_id?: number;
  chave?: string;
  destino?: string;
  ok: boolean;
  motivo?: string;
  antes?: Record<string, unknown>;
  depois?: Record<string, unknown>;
};
export type GrupoPrato = {
  chave: string;
  nome: string;
  conflito: string | null;
  unidades: string[];
  itens: {
    item_id: number;
    unidade: string;
    nome: string;
    preco: number | null;
    prato_id: number | null;
  }[];
};
export type PaginaSugestoes = {
  grupos: GrupoPrato[];
  total: number;
  proximo_cursor: string | null;
};
export type RespostaCat3 =
  | { ok: true; dados: import("./tipos").Json }
  | { ok: false; erro: { campo: string; mensagem: string; status: number } };
export type ExecutarCat3 = (pedido: PedidoCat3) => Promise<RespostaCat3>;
export function ordenarItens(itens: ItemCardapio[]) {
  return [...itens].sort(
    (a, b) =>
      (a.posicao ?? Infinity) - (b.posicao ?? Infinity) ||
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.item_id - b.item_id,
  );
}
export function moverNaOrdem(ids: number[], de: number, para: number) {
  const v = [...ids];
  const i = v.indexOf(de),
    j = v.indexOf(para);
  if (i < 0 || j < 0) return v;
  v.splice(i, 1);
  v.splice(j, 0, de);
  return v;
}
export function validarLote(d: Extract<PedidoCat3, { acao: "lote" }>) {
  if (
    d.operacao === "reajustar" &&
    Number(d.percentual !== undefined) + Number(d.valor !== undefined) !== 1
  )
    return "Informe percentual ou valor do reajuste.";
  if (d.operacao === "mover" && !d.categoria_id) return "Escolha a categoria de destino.";
  return null;
}
