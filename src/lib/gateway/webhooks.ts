/**
 * Webhooks de saída da empresa. A lista fecha os eventos que o gateway emite
 * e que o painel deixa marcar. Um evento já gravado e fora da lista continua
 * visível, para um salvamento não apagá-lo sem querer.
 */
import { z } from "zod";
import { empresa, idRecurso } from "./esquemas";

export type EventoSaida = { id: string; rotulo: string; ajuda: string; grupo: string };

export const EVENTOS_SAIDA: EventoSaida[] = [
  {
    id: "pedido.criado",
    grupo: "Pedidos",
    rotulo: "Pedido criado",
    ajuda: "A loja recebeu um pedido novo.",
  },
  {
    id: "pedido.confirmado",
    grupo: "Pedidos",
    rotulo: "Pedido confirmado",
    ajuda: "A loja confirmou o pedido.",
  },
  {
    id: "pedido.recusado",
    grupo: "Pedidos",
    rotulo: "Pedido recusado",
    ajuda: "A loja recusou o pedido.",
  },
  {
    id: "pedido.cancelado",
    grupo: "Pedidos",
    rotulo: "Pedido cancelado",
    ajuda: "O pedido foi cancelado.",
  },
  {
    id: "documento.pronto",
    grupo: "Documentos",
    rotulo: "Documento pronto",
    ajuda: "A leitura terminou (com texto ou sem texto legível). O aviso não traz o conteúdo.",
  },
  {
    id: "documento.falhou",
    grupo: "Documentos",
    rotulo: "Documento falhou",
    ajuda: "O arquivo foi rejeitado ou a leitura falhou.",
  },
  {
    id: "documento.apagado",
    grupo: "Documentos",
    rotulo: "Documento apagado",
    ajuda: "O original e a leitura foram apagados.",
  },
  {
    id: "conversa.resposta",
    grupo: "Conversa",
    rotulo: "Resposta do agente",
    ajuda: "Cada balão do agente no canal de API, para o sistema de origem entregar ao cliente.",
  },
  {
    id: "follow_up.agendado",
    grupo: "Follow-up",
    rotulo: "Follow-up agendado",
    ajuda: "Um follow-up ficou marcado. O aviso não traz o texto da pergunta.",
  },
  {
    id: "follow_up.cancelado",
    grupo: "Follow-up",
    rotulo: "Follow-up cancelado",
    ajuda: "Um follow-up agendado foi cancelado.",
  },
  {
    id: "follow_up.ensaio",
    grupo: "Follow-up",
    rotulo: "Follow-up em ensaio",
    ajuda: "Chegou a hora e o gateway registrou o que enviaria. Ainda não manda mensagem.",
  },
];

const CONHECIDOS = new Set(EVENTOS_SAIDA.map((e) => e.id));

export function gruposDeEventos(extras: string[] = []) {
  const grupos: { nome: string; eventos: EventoSaida[] }[] = [];
  for (const evento of EVENTOS_SAIDA) {
    const grupo = grupos.find((g) => g.nome === evento.grupo);
    if (grupo) grupo.eventos.push(evento);
    else grupos.push({ nome: evento.grupo, eventos: [evento] });
  }
  const desconhecidos = extras.filter((id) => !CONHECIDOS.has(id));
  if (desconhecidos.length) {
    grupos.push({
      nome: "Já marcados",
      eventos: desconhecidos.map((id) => ({
        id,
        grupo: "Já marcados",
        rotulo: id,
        ajuda: "Este evento já estava no webhook.",
      })),
    });
  }
  return grupos;
}

export type WebhookSaida = {
  id: string;
  tenant_id?: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  segredo?: string;
};

export type EntregaWebhook = {
  id: number;
  evento: string;
  tentativas: number;
  status: string;
  http_status: number | null;
  criado_em: string;
};

/**
 * A rota POST …/rotacionar-segredo já responde no gateway.
 * O botão fica escondido até a liberação explícita.
 */
export const ROTACAO_SEGREDO_LIBERADA = false;

export const webhookSchema = z.discriminatedUnion("acao", [
  z.object({ empresa, acao: z.literal("listar") }).strict(),
  z
    .object({
      empresa,
      acao: z.literal("criar"),
      url: z.string().trim().url().max(500),
      eventos: z.array(z.string().min(1).max(100)).min(1).max(40),
      ativo: z.boolean(),
    })
    .strict(),
  z
    .object({
      empresa,
      acao: z.literal("editar"),
      id: idRecurso,
      url: z.string().trim().url().max(500),
      eventos: z.array(z.string().min(1).max(100)).min(1).max(40),
      ativo: z.boolean(),
    })
    .strict(),
  z.object({ empresa, acao: z.literal("desativar"), id: idRecurso }).strict(),
  z.object({ empresa, acao: z.literal("rotacionar"), id: idRecurso }).strict(),
  z.object({ empresa, acao: z.literal("testar"), id: idRecurso }).strict(),
  z.object({ empresa, acao: z.literal("entregas"), id: idRecurso }).strict(),
]);

export type EntradaWebhook = z.infer<typeof webhookSchema>;
