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
  aguardando_humano?: boolean;
};
export type Eventos = { proximo_cursor: number; tem_mais: boolean };
/** Adaptador provisório: no máximo 20 páginas de 100 por requisição ao painel. */
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
export function ordenarConversas(itens: Conversa[]) {
  return [...itens].sort(
    (a, b) =>
      Number(!!b.aguardando_humano) - Number(!!a.aguardando_humano) ||
      (Date.parse(b.ultima_em ?? "") || 0) - (Date.parse(a.ultima_em ?? "") || 0),
  );
}
export type Leitura = { inicio: string; vistas: Record<string, string> };
export function temNovidade(c: Conversa, leitura: Leitura) {
  return (
    Date.parse(c.ultima_em ?? "") > Date.parse(leitura.vistas[c.conversation_id] ?? leitura.inicio)
  );
}
