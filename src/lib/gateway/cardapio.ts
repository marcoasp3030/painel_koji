/** Cardápio (DISP1): itens do catálogo do gateway e a disponibilidade por dia, feriado e horário. */
import { z } from "zod";
import { DIAS, problemaGrade, type Grade } from "./gestao";

export type Dia = (typeof DIAS)[number];
export type Disponibilidade = {
  dias_semana: Dia[];
  exceto_feriado: boolean;
  horario: [string, string][];
  resumo: string | null;
};
export type ItemCardapio = {
  categoria_id?: number;
  posicao?: number | null;
  prato?: { id: number; codigo: string; nome: string } | null;
  esgotado_agora?: boolean;
  esgotado_ate?: string | null;
  esgotado_motivo?: string | null;
  arquivado?: boolean;
  arquivado_em?: string | null;
  alcoolico?: boolean;
  delivery?: string;
  observacao?: string | null;
  aplicado_em?: {
    unidade: string;
    item_id: number;
    ok: boolean;
    motivo?: string;
    alterados?: string[];
  }[];
  item_id: number;
  codigo: string | null;
  unidade: string | null;
  categoria: string | null;
  nome: string;
  descricao?: string | null;
  preco: number | null;
  tipo: string;
  ativo: boolean;
  atualizado_em?: string;
  disponivel_agora?: boolean;
  indisponivel_motivo?: string | null;
  data_referencia?: string;
  disponibilidade: Disponibilidade | null;
};
export type PaginaCardapio = { itens: ItemCardapio[]; proximo_cursor: number | null };

export const SIGLAS_DIA: Record<Dia, string> = {
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
  dom: "Dom",
};

/** Estado do formulário de disponibilidade. */
export type RascunhoDisponibilidade = {
  sempre: boolean;
  dias: Dia[];
  excetoFeriado: boolean;
  faixas: [string, string][];
};

/** Sem dias cadastrados no gateway = todos os dias; o formulário mostra os sete marcados. */
export function rascunhoDe(d: Disponibilidade | null): RascunhoDisponibilidade {
  if (!d) return { sempre: true, dias: [...DIAS], excetoFeriado: false, faixas: [] };
  return {
    sempre: false,
    dias: d.dias_semana.length ? DIAS.filter((x) => d.dias_semana.includes(x)) : [...DIAS],
    excetoFeriado: d.exceto_feriado,
    faixas: d.horario.map(([a, b]) => [a, b]),
  };
}

export function problemaRascunho(r: RascunhoDisponibilidade): string | null {
  if (r.sempre) return null;
  if (r.dias.length === 0) return 'Marque pelo menos um dia ou ligue "Sempre disponível".';
  if (r.faixas.length > 12) return "Use até 12 faixas de horário.";
  return problemaGrade({ seg: r.faixas } as Grade);
}

/** Corpo do PATCH: null tira a restrição. Os sete dias vão como lista vazia (sem restrição de dia). */
export function corpoDisponibilidade(r: RascunhoDisponibilidade) {
  if (r.sempre) return null;
  const dias = DIAS.filter((d) => r.dias.includes(d));
  return {
    dias_semana: dias.length === DIAS.length ? [] : dias,
    exceto_feriado: r.excetoFeriado,
    horario: r.faixas.map(([a, b]) => [a, b] as [string, string]),
  };
}

/** Desligado, mas sem nenhuma restrição de fato: o gateway grava como "sempre disponível". */
export function semRestricao(r: RascunhoDisponibilidade) {
  return !r.sempre && r.dias.length === DIAS.length && !r.excetoFeriado && r.faixas.length === 0;
}

export function precoTexto(v: number | null) {
  return v === null
    ? "Sem preço"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const disponibilidadeSchema = z
  .object({
    dias_semana: z.array(z.enum(DIAS)).max(7),
    exceto_feriado: z.boolean(),
    horario: z.array(z.tuple([hora, hora])).max(12),
  })
  .strict()
  .superRefine((d, ctx) => {
    const erro = problemaGrade({ seg: d.horario } as Grade);
    if (erro) ctx.addIssue({ code: "custom", message: erro, path: ["disponibilidade"] });
  });
const empresa = z
  .string()
  .regex(/^[a-z0-9_]{3,40}$/)
  .nullish();
export const cardapioSchema = z.discriminatedUnion("acao", [
  z
    .object({
      empresa,
      acao: z.literal("panorama"),
      com_esgotados: z.boolean().optional(),
      arquivados: z.boolean().optional(),
    })
    .strict(),
  z.object({ empresa, acao: z.literal("obter"), item_id: z.number().int().positive() }).strict(),
  z
    .object({
      empresa,
      acao: z.literal("categorias"),
      unidade: z.string().min(1).max(40),
      arquivadas: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("historico"),
      item_id: z.number().int().positive(),
      cursor: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("previa"),
      unidade: z.string().min(1).max(40),
      disponibilidade: disponibilidadeSchema.nullable(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("editar"),
      item_id: z.number().int().positive(),
      atualizado_em: z.string().min(1),
      campos: z
        .object({
          nome: z.string().trim().min(1).max(120).optional(),
          descricao: z.string().max(300).nullable().optional(),
          preco: z.union([z.number(), z.string()]).nullable().optional(),
          ativo: z.boolean().optional(),
          categoria: z.string().min(1).optional(),
          categoria_id: z.number().int().positive().optional(),
          codigo: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/)
            .optional(),
          tipo: z.enum(["item", "adicional", "opcao_executivo", "regra"]).optional(),
          alcoolico: z.boolean().optional(),
          delivery: z.enum(["sim", "nao", "a_confirmar"]).optional(),
          observacao: z.string().max(300).nullable().optional(),
          posicao: z.number().int().nonnegative().nullable().optional(),
          aplicar_em: z.enum(["este", "todas"]).optional(),
          disponibilidade: disponibilidadeSchema.nullable().optional(),
        })
        .strict()
        .refine((v) => Object.keys(v).length > 0, "Nenhuma alteração informada."),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("listar"),
      unidade: z
        .string()
        .regex(/^[a-z0-9][a-z0-9_]{0,39}$/)
        .optional(),
      q: z.string().trim().max(200).optional(),
      ativo: z.boolean().optional(),
      cursor: z.number().int().min(0).optional(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("disponibilidade"),
      atualizado_em: z.string().min(1),
      item_id: z.number().int().positive(),
      disponibilidade: disponibilidadeSchema.nullable(),
    })
    .strict(),
]);
export type PedidoCardapio = z.input<typeof cardapioSchema>;
