import type { MensagemGateway } from "./tipos";
export type Conversa = {
  conversation_id: string;
  agente_id: string;
  canal_id: string;
  canal: string;
  nome: string | null;
  telefone: string | null;
  status: "ativa" | "pausada";
  bot_pausado_ate: string | null;
  ultima_mensagem: string | null;
  ultima_em: string | null;
  aguardando_atendente_desde: string | null;
  aguardando_motivo:
    "erro_agente" | "tempo_esgotado" | "circuito_aberto" | "entrega_incerta" | null;
};
export type Eventos = {
  proximo_cursor: number;
  tem_mais: boolean;
  itens?: { id: number; tipo: string; alvo: string }[];
};
/** Último evento já confirmado, lido antes da carga. É o `desde` do primeiro polling. */
export function desdeDoCursor(ultimoId: number) {
  if (!Number.isSafeInteger(ultimoId) || ultimoId < 0)
    throw new Error("Não foi possível acompanhar as novidades.");
  return ultimoId;
}
/** Consome páginas novas a partir de um cursor conhecido. No máximo 20 páginas de 100. */
export async function avancarCursor(
  pagina: (desde: number, limite: number) => Promise<Eventos>,
  desde = 0,
) {
  let cursor = desde;
  for (let n = 0; n < 20; n++) {
    const p = await pagina(cursor, 100);
    if (
      !Number.isSafeInteger(p.proximo_cursor) ||
      p.proximo_cursor < cursor ||
      (p.tem_mais && p.proximo_cursor === cursor)
    )
      throw new Error("Não foi possível acompanhar as novidades.");
    cursor = p.proximo_cursor;
    if (!p.tem_mais) return { cursor, completo: true };
  }
  return { cursor, completo: false };
}
export function chaveNovidades(usuario: string, empresa: string) {
  return `luxtia:conversas:${encodeURIComponent(usuario)}:${encodeURIComponent(empresa)}`;
}
export function juntarMensagens(...paginas: MensagemGateway[][]) {
  return [...new Map(paginas.flat().map((m) => [m.id, m])).values()].sort((a, b) => a.id - b.id);
}
export const MOTIVO_ATENDENTE = {
  erro_agente: "o agente deu erro",
  tempo_esgotado: "o agente demorou demais",
  circuito_aberto: "agente pausado por falhas seguidas",
  entrega_incerta: "não sabemos se a resposta chegou ao cliente",
};
export function seloEspera(desde: string, agora = Date.now()) {
  const minutos = Math.max(0, Math.floor((agora - Date.parse(desde)) / 60000));
  return `Aguardando atendente há ${Number.isFinite(minutos) ? minutos : 0} min`;
}
export function ordenarConversas(itens: Conversa[]) {
  return [...itens].sort((a, b) => {
    const pa = !!a.aguardando_atendente_desde,
      pb = !!b.aguardando_atendente_desde;
    if (pa !== pb) return Number(pb) - Number(pa);
    if (pa && pb)
      return (
        Date.parse(a.aguardando_atendente_desde!) - Date.parse(b.aguardando_atendente_desde!) ||
        a.conversation_id.localeCompare(b.conversation_id)
      );
    return (Date.parse(b.ultima_em ?? "") || 0) - (Date.parse(a.ultima_em ?? "") || 0);
  });
}
export type Leitura = { inicio: string; vistas: Record<string, string> };
export function temNovidade(c: Conversa, leitura: Leitura) {
  return (
    Date.parse(c.ultima_em ?? "") > Date.parse(leitura.vistas[c.conversation_id] ?? leitura.inicio)
  );
}

/** Só sinaliza transferências de conversas autorizadas; falha de acesso não revela o alvo. */
export async function contarEsperasVisiveis(
  eventos: NonNullable<Eventos["itens"]>,
  visivel: (alvo: string) => Promise<void>,
) {
  let total = 0;
  for (const e of eventos) {
    if (e.tipo !== "conversa.aguardando_atendente") continue;
    try {
      await visivel(e.alvo);
      total++;
    } catch {
      /* Fail closed. */
    }
  }
  return total;
}
