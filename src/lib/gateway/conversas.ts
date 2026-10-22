import type { MensagemGateway } from "./tipos";
export type EstadoConversa = "encerrada" | "aguardando_atendente" | "atendente" | "bot";
export const ESTADOS_CONVERSA: EstadoConversa[] = [
  "bot",
  "atendente",
  "aguardando_atendente",
  "encerrada",
];
export type OrigemNome =
  "cadastro" | "informado" | "perfil" | "telefone" | "identificador" | "anonimizado";
export type CanalInfo = {
  id: string;
  tipo: string;
  nome: string | null;
  icone: string | null;
  teste: boolean;
};
/** Item de `GET/PATCH /contatos` (PED1-c). */
export type ContatoPainel = {
  id: string;
  nome: string | null;
  nome_exibicao: string;
  nome_origem: OrigemNome;
  nomes: { cadastro: string | null; informado: string | null; perfil: string | null };
  telefone_e164: string | null;
  telefone_formatado: string | null;
  anonimizado_em: string | null;
};
export type UltimaMensagem = {
  texto: string | null;
  em: string | null;
  direcao: "entrada" | "saida" | null;
  origem: string | null;
  tipo: string | null;
};
export type Conversa = {
  atendimento?: import("./enc1").AtendimentoConversa | null;
  conversation_id: string;
  agente_id: string;
  canal_id?: string;
  /** Tipo do canal (`uazapi`, `api`…). O nome cadastrado vem de `GET /canais`. */
  canal: string;
  nome: string | null;
  telefone: string | null;
  /** PED1-c (ESPEC_PED1, seção 14). Opcionais para tolerar um gateway anterior. */
  contato_id?: string | null;
  nome_exibicao?: string | null;
  nome_origem?: OrigemNome | null;
  nomes?: { cadastro: string | null; informado: string | null; perfil: string | null };
  telefone_e164?: string | null;
  telefone_formatado?: string | null;
  canal_info?: CanalInfo | null;
  unidade_preferida?: string | null;
  unidade_preferida_nome?: string | null;
  estado?: EstadoConversa;
  ultima?: UltimaMensagem | null;
  pedido_aberto?: { numero: string; status: string } | null;
  /** FUP1-a: presente quando há follow-up agendado. */
  follow_up?: { estado: string; previsto_em: string | null } | null;
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
/** Estado único do gateway (PED1-c); sem ele, a mesma ordem: encerrada, aguardando, pausa vigente, bot. */
export function estadoConversa(
  c: Pick<
    Conversa,
    "encerrada_em" | "aguardando_atendente_desde" | "status" | "bot_pausado_ate"
  > & {
    estado?: EstadoConversa | undefined;
  },
  agora = Date.now(),
): EstadoConversa {
  if (c.estado && ESTADOS_CONVERSA.includes(c.estado)) return c.estado;
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
/** Selo discreto de onde veio o nome exibido. Origens sem selo devolvem null. */
export const ROTULO_ORIGEM_NOME: Partial<Record<OrigemNome, { rotulo: string; ajuda: string }>> = {
  cadastro: { rotulo: "cadastro", ajuda: "Nome cadastrado no painel" },
  informado: { rotulo: "informado", ajuda: "Nome que o cliente disse na conversa" },
  perfil: { rotulo: "perfil", ajuda: "Nome do perfil do WhatsApp" },
  telefone: { rotulo: "telefone", ajuda: "Ainda sem nome: mostra o telefone" },
  anonimizado: { rotulo: "anonimizado", ajuda: "Dados pessoais removidos (LGPD)" },
};
export function seloOrigemNome(origem: OrigemNome | null | undefined) {
  return origem ? (ROTULO_ORIGEM_NOME[origem] ?? null) : null;
}
const ROTULO_TIPO_MENSAGEM: Record<string, string> = {
  audio: "Áudio",
  imagem: "Imagem",
  video: "Vídeo",
  documento: "Documento",
  localizacao: "Localização",
  figurinha: "Figurinha",
  contato: "Contato",
  reacao: "Reação",
  desconhecido: "Mensagem",
};
/** Última mensagem com autor e tipo (PED1-c). Sem `ultima`, usa o texto antigo sem autor. */
export function resumoUltima(c: Pick<Conversa, "ultima" | "ultima_mensagem" | "ultima_em">) {
  const u = c.ultima;
  if (!u) return { autor: null, tipo: null, texto: c.ultima_mensagem, em: c.ultima_em };
  const autor = u.origem ? (AUTOR_MENSAGEM[u.origem] ?? u.origem) : null;
  const tipo = u.tipo && u.tipo !== "texto" ? (ROTULO_TIPO_MENSAGEM[u.tipo] ?? u.tipo) : null;
  return { autor, tipo, texto: u.texto, em: u.em ?? c.ultima_em };
}
const AUTOR_MENSAGEM: Record<string, string> = {
  cliente: "Cliente",
  bot: "IA",
  humano: "Atendente",
  sistema: "Sistema",
};
/** Tipo e nome do canal: `canal_info` do gateway, senão o tipo da conversa com o nome de `GET /canais`. */
export function canalDaConversa(
  c: Pick<Conversa, "canal" | "canal_info">,
  cadastro?: { tipo?: string; nome?: string | null } | undefined,
) {
  const info = c.canal_info;
  return {
    tipo: info?.tipo || cadastro?.tipo || c.canal,
    nome: info?.nome ?? cadastro?.nome ?? null,
    teste: Boolean(info?.teste),
  };
}
export const MOTIVO_NOME: Record<string, string> = {
  tamanho: "O nome precisa ter de 2 a 60 caracteres.",
  telefone: "O nome não pode ter número de telefone.",
  caractere: "O nome não pode ter emoji nem símbolos.",
  letras: "O nome precisa ter pelo menos duas letras.",
};
/**
 * Mesma regra do gateway para o nome de cadastro. Vazio = null (apaga o cadastro).
 * O gateway confere de novo; isto só evita a viagem.
 */
export function validarNomeCadastro(
  bruto: string,
): { ok: true; nome: string | null } | { ok: false; motivo: keyof typeof MOTIVO_NOME } {
  const nome = bruto.split(/\s+/).filter(Boolean).join(" ");
  if (!nome) return { ok: true, nome: null };
  if (nome.length < 2 || nome.length > 60) return { ok: false, motivo: "tamanho" };
  if (/(?:\d[\s().+-]*){8,}/.test(nome)) return { ok: false, motivo: "telefone" };
  if (/[\p{So}\p{Sk}\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\uFE00-\uFE0F]/u.test(nome))
    return { ok: false, motivo: "caractere" };
  if ((nome.match(/\p{L}/gu) ?? []).length < 2) return { ok: false, motivo: "letras" };
  return { ok: true, nome };
}
/** O que passa a valer se o nome de cadastro for apagado: informado > perfil > telefone. */
export function nomeSemCadastro(
  c: Pick<Conversa, "nomes" | "telefone" | "telefone_formatado">,
): string {
  const letras = (v: string | null | undefined) => (v && /\p{L}/u.test(v) ? v : null);
  return letras(c.nomes?.informado) ?? letras(c.nomes?.perfil) ?? telefoneVisivel(c) ?? "Contato";
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
/**
 * Fila de espera primeiro (mais antiga no topo). O resto por atividade recente ou,
 * com `porRecencia: false`, na ordem em que o gateway devolveu.
 */
export function ordenarConversas(itens: Conversa[], { porRecencia = true } = {}) {
  return [...itens].sort((a, b) => {
    const pa = !!a.aguardando_atendente_desde,
      pb = !!b.aguardando_atendente_desde;
    if (pa !== pb) return Number(pb) - Number(pa);
    if (pa && pb)
      return (
        Date.parse(a.aguardando_atendente_desde!) - Date.parse(b.aguardando_atendente_desde!) ||
        a.conversation_id.localeCompare(b.conversation_id)
      );
    if (!porRecencia) return 0;
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
