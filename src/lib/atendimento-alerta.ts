/**
 * ATD-ALERTA: preferências e helpers do alerta de cliente aguardando atendente.
 * Preferências em localStorage, por usuário (como pedidos-som).
 */

export const EVENTO_ATENDIMENTO_SOM = "luxbrain:atendimento-som";
export const EVENTO_ATENDIMENTO_PREFS = "luxbrain:atendimento-prefs";
export const EVENTO_ABRIR_FILA_ATENDIMENTO = "luxbrain:conversas-fila";

export type UrgenciaAlerta = "dourado" | "laranja" | "vermelho";

/** Até 2 min dourado; 2–5 laranja; acima de 5 vermelho. */
export function urgenciaAlerta(desde: string | null | undefined, agora = Date.now()): UrgenciaAlerta {
  if (!desde) return "dourado";
  const instante = Date.parse(desde);
  if (!Number.isFinite(instante)) return "dourado";
  const minutos = (agora - instante) / 60_000;
  if (minutos >= 5) return "vermelho";
  if (minutos >= 2) return "laranja";
  return "dourado";
}

export function classesSeloAlerta(urgencia: UrgenciaAlerta) {
  if (urgencia === "vermelho")
    return "bg-destructive text-white motion-safe:animate-[pisca-lenta_1.6s_ease-in-out_infinite]";
  if (urgencia === "laranja") return "bg-orange-500 text-white";
  return "bg-gold-500 text-purple-900";
}

export function chaveSomAtendimento(usuario: string) {
  return `luxbrain:atendimento-som:${usuario}`;
}
export function chaveLembreteAtendimento(usuario: string) {
  return `luxbrain:atendimento-lembrete:${usuario}`;
}
export function chaveNotificacaoAtendimento(usuario: string) {
  return `luxbrain:atendimento-notificacao:${usuario}`;
}

/** Som ligado por padrão (atendente/supervisor/gestor). */
export function somAtendimentoLigado(usuario: string) {
  try {
    const v = localStorage.getItem(chaveSomAtendimento(usuario));
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function definirSomAtendimento(usuario: string, ligado: boolean) {
  try {
    localStorage.setItem(chaveSomAtendimento(usuario), ligado ? "1" : "0");
  } catch {
    /* Preferência vale na sessão. */
  }
  window.dispatchEvent(new Event(EVENTO_ATENDIMENTO_SOM));
  window.dispatchEvent(new Event(EVENTO_ATENDIMENTO_PREFS));
}

/** Lembrete a cada 2 min ligado por padrão. */
export function lembreteAtendimentoLigado(usuario: string) {
  try {
    const v = localStorage.getItem(chaveLembreteAtendimento(usuario));
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function definirLembreteAtendimento(usuario: string, ligado: boolean) {
  try {
    localStorage.setItem(chaveLembreteAtendimento(usuario), ligado ? "1" : "0");
  } catch {
    /* Preferência vale na sessão. */
  }
  window.dispatchEvent(new Event(EVENTO_ATENDIMENTO_PREFS));
}

export function notificacaoAtendimentoLigada(usuario: string) {
  try {
    return localStorage.getItem(chaveNotificacaoAtendimento(usuario)) === "1";
  } catch {
    return false;
  }
}

export function definirNotificacaoAtendimento(usuario: string, ligada: boolean) {
  try {
    localStorage.setItem(chaveNotificacaoAtendimento(usuario), ligada ? "1" : "0");
  } catch {
    /* Preferência vale na sessão. */
  }
  window.dispatchEvent(new Event(EVENTO_ATENDIMENTO_PREFS));
}

/**
 * Dois toques (~0,5 s), distinto do bip único de pedido.
 * Devolve false se o navegador bloqueou o áudio (precisa de clique).
 */
export function tocarChamadaAtendimento(): boolean {
  try {
    const audio = new AudioContext();
    if (audio.state === "suspended") {
      void audio.close();
      return false;
    }
    const tocar = (atraso: number, freq: number) => {
      const osc = audio.createOscillator();
      const ganho = audio.createGain();
      osc.frequency.value = freq;
      ganho.gain.value = 0.05;
      osc.connect(ganho);
      ganho.connect(audio.destination);
      const ini = audio.currentTime + atraso;
      osc.start(ini);
      ganho.gain.setValueAtTime(0.05, ini);
      ganho.gain.exponentialRampToValueAtTime(0.001, ini + 0.18);
      osc.stop(ini + 0.2);
    };
    tocar(0, 740);
    tocar(0.28, 990);
    window.setTimeout(() => void audio.close(), 700);
    return true;
  } catch {
    return false;
  }
}

/** Desbloqueia o áudio após um clique do usuário. */
export async function desbloquearAudioAtendimento(): Promise<boolean> {
  try {
    const audio = new AudioContext();
    await audio.resume();
    const ok = audio.state === "running";
    await audio.close();
    return ok;
  } catch {
    return false;
  }
}

export function telefoneMascaradoAlerta(telefone: string | null | undefined) {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length >= 4) return `****${digitos.slice(-4)}`;
  return telefone;
}

export function nomeNaFila(c: {
  nome_exibicao?: string | null;
  nome?: string | null;
  telefone?: string | null;
  telefone_formatado?: string | null;
}) {
  const nome = (c.nome_exibicao || c.nome || "").trim();
  if (nome) return nome;
  return (
    telefoneMascaradoAlerta(c.telefone_formatado || c.telefone) || "Cliente"
  );
}

/** Motivos do gateway + rótulos do painel (inclui transferência pelo agente). */
export const MOTIVO_ATENDENTE_ALERTA: Record<string, string> = {
  erro_agente: "o agente deu erro",
  tempo_esgotado: "o agente demorou demais",
  circuito_aberto: "agente pausado por falhas seguidas",
  entrega_incerta: "não sabemos se a resposta chegou ao cliente",
  pediu_humano: "cliente pediu atendente",
  transferido_pelo_agente: "agente transferiu",
  silencio_sem_motivo: "agente ficou em silêncio",
  reclamacao: "reclamação",
};

export function rotuloMotivoAtendimento(motivo: string | null | undefined) {
  if (!motivo) return "aguardando atendente";
  return MOTIVO_ATENDENTE_ALERTA[motivo] ?? motivo.replace(/_/g, " ");
}

export type ItemFilaAlerta = {
  conversation_id: string;
  aguardando_atendente_desde: string | null;
  atribuida_a?: string | null;
};

/** Chave estável: id + instante em que entrou na fila. */
export function chaveFila(c: ItemFilaAlerta) {
  return `${c.conversation_id}|${c.aguardando_atendente_desde ?? ""}`;
}

/**
 * Conversas novas na fila (id+desde que ainda não estavam).
 * Ignora quem já tem atendente atribuído para o som/toast.
 */
export function conversasNovasNaFila(
  anteriores: ReadonlyMap<string, string>,
  atuais: ItemFilaAlerta[],
) {
  const novas: ItemFilaAlerta[] = [];
  for (const c of atuais) {
    if (!c.aguardando_atendente_desde) continue;
    if (c.atribuida_a) continue;
    const k = chaveFila(c);
    if (!anteriores.has(k)) novas.push(c);
  }
  return novas;
}

export function mapaDaFila(itens: ItemFilaAlerta[]) {
  const m = new Map<string, string>();
  for (const c of itens) {
    if (c.aguardando_atendente_desde) m.set(chaveFila(c), c.aguardando_atendente_desde);
  }
  return m;
}

export const LEMBRETE_INTERVALO_MS = 2 * 60_000;
export const LEMBRETE_MAX_POR_CONVERSA = 5;

/**
 * Decide se esta conversa deve receber lembrete agora.
 * `toques` = quantas vezes já lembramos (sem contar o som da entrada).
 */
export function deveLembrar(opts: {
  atribuida_a: string | null | undefined;
  toques: number;
  ultimoToqueEm: number | null;
  agora?: number;
}) {
  if (opts.atribuida_a) return false;
  if (opts.toques >= LEMBRETE_MAX_POR_CONVERSA) return false;
  const agora = opts.agora ?? Date.now();
  if (opts.ultimoToqueEm == null) return false;
  return agora - opts.ultimoToqueEm >= LEMBRETE_INTERVALO_MS;
}

export function tituloAbaAguardando(n: number) {
  if (n <= 0) return null;
  return `(${n}) Cliente aguardando`;
}

export function podeVerAlertaAtendimento(papel: string | null | undefined) {
  return (
    papel === "plataforma" ||
    papel === "gestor" ||
    papel === "supervisor" ||
    papel === "funcionario"
  );
}
