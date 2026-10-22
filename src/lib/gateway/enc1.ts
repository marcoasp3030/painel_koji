import { z } from "zod";
export type AtendimentoConversa = {
  id: string;
  numero: number;
  estado: "aberto" | "em_atendimento_humano" | "encerrado";
  aberto_em: string;
  encerrado_em: string | null;
  motivo_encerramento: string | null;
  motivo_inicio?: string;
  desfecho?: string | null;
  resumo?: string | null;
  mensagens?: number;
  pedidos?: {
    numero: string | number;
    status: string;
    modalidade: string;
    total: number | null;
  }[];
};
export type PaginaAtendimentos = { itens: AtendimentoConversa[]; proximo_cursor: number | null };
export const enc1Schema = z
  .object({
    empresa: z
      .string()
      .regex(/^[a-z0-9_]{3,40}$/)
      .nullish(),
    conversa: z.string().min(3).max(300),
    acao: z.enum(["listar", "encerrar", "reabrir"]),
    cursor: z.number().int().positive().optional(),
  })
  .strict();
export type PedidoEnc1 = z.input<typeof enc1Schema>;
export type RespostaEnc1 =
  | { ok: true; dados: PaginaAtendimentos | { atendimento: AtendimentoConversa } }
  | { ok: false; mensagem: string; status: number };
export const ROTULO_ATENDIMENTO = {
  aberto: "Aberto",
  em_atendimento_humano: "Com humano",
  encerrado: "Encerrado",
};
const MOTIVOS: Record<string, string> = {
  manual: "Encerrado pela equipe",
  concluido: "Encerrado pelo agente",
  pedido_concluido: "Pedido concluído e o cliente agradeceu",
  pedido_sem_retorno: "Pedido feito, sem retorno do cliente",
  vazio: "Conversa sem mensagem",
  primeiro_contato: "Primeiro contato",
  retorno_apos_encerramento: "Retorno após encerramento",
  reaberto_manual: "Reaberto pela equipe",
  migracao: "Atendimento já existente",
};
const DESFECHOS: Record<string, string> = {
  pedido_feito: "Pedido feito",
  duvida_respondida: "Dúvida respondida",
  vazia: "Vazia",
};
export function motivoAtendimento(v: string | null | undefined) {
  if (!v) return "—";
  return MOTIVOS[v] ?? v.replaceAll("_", " ");
}
export function desfechoAtendimento(v: string | null | undefined) {
  if (!v) return null;
  return DESFECHOS[v] ?? v.replaceAll("_", " ");
}
