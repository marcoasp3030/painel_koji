import type { MensagemGateway } from "./tipos";
export type EstadoConversa = "encerrada" | "aguardando_atendente" | "atendente" | "bot";
export type Conversa = {
  conversation_id: string;
  agente_id: string;
  canal_id?: string;
  /** Tipo do canal (`uazapi`, `api`…). O nome cadastrado vem de `GET /canais`. */
  canal: string;
  nome: string | null;
  telefone: string | null;
  /** PED1-c, quando o gateway passar a enviar. */
  nome_exibicao?: string | null;
  telefone_formatado?: string | null;
  status: "ativa" | "pausada";
  bot_pausado_ate: string | null;
  ultima_mensagem: string | null;
  ultima_em: string | null;
  aguardando_atendente_desde: string | null;
  aguardando_motivo:
    "erro_agente" | "tempo_esgotado" | "circuito_aberto" | "entrega_incerta" | null;
  encerrada_em?: string | null;
  desfecho?: string | null;
  atualizado_em?: string | null;
};
const ROTULO_TIPO_CANAL: Record<string, string> = {
  uazapi: "WhatsApp",
  meta: "WhatsApp",
  site: "Site",
  api: "API",
  email: "E-mail",
  teams: "Teams",
  luxbrain: "Luxbrain",
};
export const ROTULO_ESTADO: Record<EstadoConversa, string> = {
  encerrada: "Encerrada",
  aguardando_atendente: "Aguardando atendente",
  atendente: "Atendente",
  bot: "Bot",
};
function preenchido(v: string | null | undefined) {
  return Boolean(v && v.trim());
}
/** Ordem do contrato atual: encerrada, aguardando, pausa vigente, bot. */
export function estadoConversa(
  c: Pick<Conversa, "encerrada_em" | "aguardando_atendente_desde" | "status" | "bot_pausado_ate">,
  agora = Date.now(),
): EstadoConversa {
  if (preenchido(c.encerrada_em)) return "encerrada";
  if (preenchido(c.aguardando_atendente_desde)) return "aguardando_atendente";
  const pausa = c.bot_pausado_ate ? Date.parse(c.bot_pausado_ate) : NaN;
  if (c.status === "pausada" || (Number.isFinite(pausa) && pausa > agora)) return "atendente";
  return "bot";
}
/** Dígitos de telefone viram leitura. Identificador que não é telefone volta como veio. */
export function telefoneExibicao(telefone: string | null | undefined) {
  if (!telefone) return null;
  if (!/^\d{10,15}$/.test(telefone)) return telefone;
  if (/^55\d{2}9\d{8}$/.test(telefone)) {
    const ddd = telefone.slice(2, 4);
    const movel = telefone.slice(4);
    return `+55 ${ddd} ${movel.slice(0, 5)}-${movel.slice(5)}`;
  }
  return `+${telefone}`;
}
export function telefoneVisivel(c: Pick<Conversa, "telefone" | "telefone_formatado">) {
  const pronto = c.telefone_formatado?.trim();
  if (pronto) return pronto;
  return telefoneExibicao(c.telefone);
}
/** Nome do gateway, senão o telefone legível, senão “Contato”. */
export function nomeContato(
  c: Pick<Conversa, "nome" | "telefone" | "nome_exibicao" | "telefone_formatado">,
) {
  const pronto = c.nome_exibicao?.trim();
  if (pronto) return pronto;
  const nome = c.nome?.trim();
  if (nome) return nome;
  return telefoneVisivel(c) ?? "Contato";
}
export function rotuloTipoCanal(tipo: string | null | undefined) {
  if (!tipo) return "Canal";
  return ROTULO_TIPO_CANAL[tipo] ?? tipo;
}
export function textoCanal(tipo: string | null | undefined, nome: string | null | undefined) {
  const rotulo = rotuloTipoCanal(tipo);
  const cadastrado = nome?.trim();
  if (!cadastrado || cadastrado === rotulo) return rotulo;
  return `${rotulo} · ${cadastrado}`;
}
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
