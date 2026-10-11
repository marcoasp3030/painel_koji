import { z } from "zod";
import { empresa } from "./esquemas";
const alvo = { empresa };
const status = z.enum([
  "confirmado",
  "em_preparo",
  "pronto_retirada",
  "saiu_entrega",
  "concluido",
  "recusado",
  "cancelado",
]);
const modalidade = z.enum(["delivery", "retirada"]);
export const avisoSchema = z
  .discriminatedUnion("acao", [
    z.object({ ...alvo, acao: z.literal("ler") }).strict(),
    z
      .object({
        ...alvo,
        acao: z.literal("salvar"),
        status,
        modalidade,
        texto: z.string().trim().min(1).max(1000).nullable().optional(),
        ativo: z.boolean().nullable().optional(),
      })
      .strict(),
    z
      .object({
        ...alvo,
        acao: z.literal("previa"),
        status,
        modalidade,
        texto: z.string().trim().min(1).max(1000),
      })
      .strict(),
    z
      .object({
        ...alvo,
        acao: z.literal("reenviar"),
        status,
        numero: z.string().regex(/^\d{1,20}$/),
        mesmo_incerto: z.literal(true).optional(),
      })
      .strict(),
  ])
  .refine(
    (d) => d.acao !== "salvar" || d.texto !== undefined || d.ativo !== undefined,
    "Informe texto ou ativação.",
  );
export type ConfigAvisos = { variaveis: string[]; max_texto: number; itens: ConfigAviso[] };
export type ConfigAviso = {
  status: string;
  status_descricao: string;
  modalidade: "delivery" | "retirada";
  ativo: boolean;
  texto: string;
  ativo_padrao: boolean;
  texto_padrao: string;
  padrao: boolean;
};
export type PreviaAviso = { texto: string; texto_sem_opcionais: string };
