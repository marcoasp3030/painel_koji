/**
 * Follow-up (FUP1-a): rótulos, janela de horário e o que a conversa mostra.
 * O gateway, por enquanto, só ensaia — não envia a mensagem.
 */
import { z } from "zod";
import { empresa, idRecurso } from "./esquemas";

export const DIAS_JANELA = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
const HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const ROTULO_ESTADO_FOLLOWUP: Record<
  string,
  { rotulo: string; tom: "sucesso" | "alerta" | "perigo" | "roxo" | "neutro" }
> = {
  agendado: { rotulo: "Agendado", tom: "roxo" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
  ensaio_enviaria: { rotulo: "Ensaio", tom: "alerta" },
  gerando: { rotulo: "Gerando", tom: "roxo" },
  enviado: { rotulo: "Enviado", tom: "sucesso" },
  falhou: { rotulo: "Falhou", tom: "perigo" },
  incerto: { rotulo: "Incerto", tom: "alerta" },
};

export const ROTULO_TIPO_PENDENCIA: Record<string, string> = {
  confirmar_pedido: "Confirmar pedido",
  escolher_item: "Escolher item",
  informar_quantidade: "Informar quantidade",
  informar_horario: "Informar horário",
  informar_endereco: "Informar endereço",
  escolher_unidade: "Escolher unidade",
  informar_modalidade: "Entrega ou retirada",
  outro: "Outra pergunta",
};

export const ROTULO_MOTIVO_FOLLOWUP: Record<string, string> = {
  cliente_respondeu: "O cliente respondeu",
  pedido_fechado: "O pedido foi fechado",
  com_atendente: "A conversa está com um atendente",
  encerrado: "O atendimento foi encerrado",
  desligado: "O follow-up foi desligado",
  opt_out: "O contato não quer follow-up",
  substituido: "Entrou outra pendência",
  fora_da_janela: "Fora do horário",
  pendencia_expirada: "A pendência passou de 24 horas",
  pendencia_invalida: "A pendência não valia mais",
  limite_do_dia: "Limite do dia",
  fora_do_piloto: "Fora do piloto",
  painel: "Cancelado no painel",
  anonimizado: "Contato anonimizado",
};

export const ROTULO_ORIGEM_OPTOUT: Record<string, string> = {
  agente: "pelo agente",
  frase: "por uma frase do cliente",
  painel: "pelo painel",
};

export type TarefaFollowUp = {
  id: number;
  atendimento_id: string | null;
  agente_id: string | null;
  ordinal: number;
  tipo: string | null;
  pergunta: string | null;
  estado: string;
  motivo: string | null;
  previsto_em: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

export type OptOutFollowUp = {
  ativo: boolean;
  origem: string | null;
  criado_em: string | null;
  actor: string | null;
  removido_em: string | null;
  removido_por: string | null;
};

export type ListaFollowUp = {
  itens: TarefaFollowUp[];
  atendimento_atual: string | null;
  opt_out: OptOutFollowUp | null;
  /** A rota ainda não existe neste gateway (404). A conversa segue normal. */
  indisponivel?: boolean;
};

export const MENSAGEM_FOLLOWUP_AUSENTE = "Follow-up ainda não está disponível.";

export function listaFollowUpAusente(): ListaFollowUp {
  return { itens: [], atendimento_atual: null, opt_out: null, indisponivel: true };
}

export function rotuloTipoPendencia(tipo: string | null | undefined) {
  if (!tipo) return "Pendência";
  return ROTULO_TIPO_PENDENCIA[tipo] ?? tipo;
}

export function rotuloMotivoFollowUp(motivo: string | null | undefined) {
  if (!motivo) return "";
  return ROTULO_MOTIVO_FOLLOWUP[motivo] ?? motivo;
}

/** Lê a janela quando todos os dias têm o mesmo horário. Senão, devolve o padrão e marca que não é uniforme. */
export function lerJanela(valor: unknown): { inicio: string; fim: string; uniforme: boolean } {
  const padrao = { inicio: "09:00", fim: "22:00", uniforme: false };
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return padrao;
  const grade = valor as Record<string, unknown>;
  const faixas = DIAS_JANELA.map((dia) => grade[dia]);
  const primeira = faixas[0];
  const igual = faixas.every((faixa) => JSON.stringify(faixa) === JSON.stringify(primeira));
  if (!igual || !Array.isArray(primeira) || primeira.length !== 1 || !Array.isArray(primeira[0])) {
    return padrao;
  }
  const [inicio, fim] = primeira[0] as unknown[];
  if (
    typeof inicio !== "string" ||
    typeof fim !== "string" ||
    !HORA.test(inicio) ||
    !HORA.test(fim) ||
    inicio === fim
  ) {
    return padrao;
  }
  return { inicio, fim, uniforme: true };
}

/** Grade semanal no formato do gateway: um turno igual em cada dia. */
export function gradeJanela(
  inicio: string,
  fim: string,
): Record<string, [string, string][]> | null {
  if (!HORA.test(inicio) || !HORA.test(fim) || inicio === fim) return null;
  return Object.fromEntries(DIAS_JANELA.map((dia) => [dia, [[inicio, fim]]]));
}

export const followUpSchema = z.discriminatedUnion("acao", [
  z.object({ empresa, acao: z.literal("listar"), conversa: z.string().min(3).max(300) }).strict(),
  z
    .object({
      empresa,
      acao: z.literal("cancelar"),
      conversa: z.string().min(3).max(300),
      motivo: z
        .string()
        .regex(/^[a-z0-9_]{1,60}$/)
        .optional(),
    })
    .strict(),
  z.object({ empresa, acao: z.literal("ver_opt_out"), contato: idRecurso }).strict(),
  z
    .object({
      empresa,
      acao: z.literal("reativar"),
      contato: idRecurso,
      motivo: z.string().trim().min(3, "Escreva o motivo.").max(300),
    })
    .strict(),
]);

export type EntradaFollowUp = z.infer<typeof followUpSchema>;
