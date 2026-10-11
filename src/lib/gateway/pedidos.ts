import { z } from "zod";
import { empresa } from "./esquemas";
import { telefoneExibicao } from "./conversas";

export const STATUS_PEDIDO = [
  "aguardando_loja",
  "confirmado",
  "em_preparo",
  "pronto_retirada",
  "saiu_entrega",
  "concluido",
  "recusado",
  "cancelado",
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  aguardando_loja: "Aguardando loja",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  pronto_retirada: "Pronto para retirada",
  saiu_entrega: "Saiu para entrega",
  concluido: "Concluído",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

/** Colunas do quadro. O status de cada cartão continua o do gateway. */
export const COLUNAS_PEDIDO = [
  { id: "aguardando", rotulo: "Aguardando loja", status: ["aguardando_loja"] },
  { id: "confirmado", rotulo: "Confirmado", status: ["confirmado"] },
  { id: "preparo", rotulo: "Em preparo", status: ["em_preparo"] },
  {
    id: "saida",
    rotulo: "Pronto para retirada / Saiu para entrega",
    status: ["pronto_retirada", "saiu_entrega"],
  },
  { id: "concluido", rotulo: "Concluído", status: ["concluido"] },
] as const;

const ROTULO_ACAO: Record<string, string> = {
  confirmado: "Confirmar",
  em_preparo: "Em preparo",
  pronto_retirada: "Pronto para retirada",
  saiu_entrega: "Saiu para entrega",
  concluido: "Concluir",
  recusado: "Recusar",
  cancelado: "Cancelar",
};

export type AcaoPedido = {
  status: string;
  rotulo: string;
  previsao: boolean;
  motivo: "obrigatorio" | "opcional" | null;
};

/** Só os próximos status que o gateway devolveu, na ordem recebida. */
export function acoesPedido(proximos: readonly string[]): AcaoPedido[] {
  const vistos = new Set<string>();
  const saida: AcaoPedido[] = [];
  for (const status of proximos) {
    const rotulo = ROTULO_ACAO[status];
    if (!rotulo || vistos.has(status)) continue;
    vistos.add(status);
    saida.push({
      status,
      rotulo,
      previsao: status === "confirmado" || status === "em_preparo",
      motivo: status === "cancelado" ? "obrigatorio" : status === "recusado" ? "opcional" : null,
    });
  }
  return saida;
}

export const ROTULO_AVISO: Record<string, string> = {
  enviado: "Aviso enviado",
  falhou: "Aviso falhou",
  desligado: "Aviso desligado",
  pendente: "Aviso pendente",
  simulado: "Aviso simulado",
  descartado: "Aviso não enviado",
};

export function textoAviso(status: string | null | undefined) {
  if (!status) return null;
  return ROTULO_AVISO[status] ?? "Aviso não informado";
}

export function tempoDesde(iso: string | null | undefined, agora = Date.now()) {
  if (!iso) return "horário não informado";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "horário não informado";
  const min = Math.max(0, Math.floor((agora - t) / 60000));
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `há ${horas} h ${resto} min` : `há ${horas} h`;
}

/** E.164 do pedido (`+5511…`) ou identificador que não é telefone. */
export function whatsappPedido(telefone: string | null | undefined) {
  if (!telefone) return null;
  const digitos = telefone.startsWith("+") ? telefone.slice(1) : telefone;
  if (/^\d{10,15}$/.test(digitos)) return telefoneExibicao(digitos);
  return telefone;
}

export function reais(valor: number | null | undefined) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "Total não informado";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const numero = z.string().regex(/^\d{1,20}$/);
const comFuso = z.string().regex(/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:\d{2})$/);
const alvo = { empresa };
export const pedidoSchema = z.discriminatedUnion("acao", [
  z
    .object({
      ...alvo,
      acao: z.literal("listar"),
      status: z.array(z.enum(STATUS_PEDIDO)).max(8).optional(),
      unidade: z.string().max(80).optional(),
      modalidade: z.enum(["delivery", "retirada"]).optional(),
      desde: comFuso.optional(),
      ate: comFuso.optional(),
      busca: z.string().trim().min(2).max(100).optional(),
      cursor: z.number().int().positive().nullable().optional(),
      limite: z.number().int().min(1).max(100).optional(),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("contagem") }).strict(),
  z.object({ ...alvo, acao: z.literal("detalhe"), numero }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("status"),
      numero,
      status: z.enum(STATUS_PEDIDO),
      motivo: z.string().max(300).optional(),
      previsao_min: z.number().int().optional(),
    })
    .strict(),
]);
export type PedidoEntrada = z.infer<typeof pedidoSchema>;

export type AvisoPedido = { status: string; em?: string | null; erro?: string | null } | null;
export type ItemPedido = {
  codigo: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao: string | null;
  alcoolico: boolean;
};
export type PedidoLista = {
  id: number;
  numero: string;
  status: StatusPedido;
  modalidade: "delivery" | "retirada" | null;
  unidade: string | null;
  unidade_nome: string | null;
  cliente: {
    nome: string | null;
    telefone: string | null;
    canal: { id: string; tipo: string; nome: string; icone: string } | null;
  };
  conversation_id: string | null;
  numero_itens: number;
  total: number | null;
  previsao_min: number | null;
  criado_em: string;
  atualizado_em: string | null;
  horario: string | null;
  aviso: AvisoPedido;
};
export type EventoPedido = {
  de: string | null;
  para: string;
  por: string | null;
  origem: string | null;
  em: string;
  motivo: string | null;
  previsao_min: number | null;
  aviso: AvisoPedido;
};
export type PedidoDetalhe = PedidoLista & {
  itens: ItemPedido[];
  subtotal: number | null;
  taxa_entrega: number | null;
  observacao: string | null;
  endereco: string | null;
  motivo: string | null;
  status_descricao: string | null;
  entrega: {
    modalidade: string | null;
    endereco: string | null;
    horario: string | null;
    observacao: string | null;
  } | null;
  proximos_status: string[];
  linha_do_tempo: EventoPedido[];
};
export type ContagemPedidos = {
  aguardando_loja: {
    total: number;
    mais_antigo_em: string | null;
    por_unidade: { unidade: string; nome: string; total: number; mais_antigo_em: string | null }[];
  };
  em_andamento: Record<string, number>;
  avisos_com_falha: number;
};
