/**
 * Comportamento do agente (CFG1-a, gateway/docs/ESPEC_CFG1.md §13).
 * A tela é desenhada a partir do `esquema` do gateway: tipos, limites, opções, padrão,
 * `editavel` e `disponivel` vêm de lá. Aqui ficam só a entrada das ações, os tipos,
 * os textos da tela e funções puras. Nenhuma regra de validação é repetida.
 */
import { z } from "zod";
import { empresa, idRecurso, json } from "./esquemas";
import type { Json } from "./tipos";

// ---------------------------------------------------------------- entrada das ações
const alvo = { empresa, agente: idRecurso.optional() };
const parte = z.record(z.string().max(60), json);
const nota = z.string().trim().max(300).optional();
export const atendimentoSchema = z.discriminatedUnion("acao", [
  z.object({ ...alvo, acao: z.literal("ler") }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("salvar"),
      baseado_em: z.number().int().min(0),
      perfil: parte.optional(),
      comportamentos: parte.optional(),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("descartar") }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("publicar"),
      baseado_em: z.number().int().min(0),
      nota,
      confirmar_avisos: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("versoes"),
      cursor: z.number().int().min(0).nullish(),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("versao"), versao: z.number().int().min(1) }).strict(),
  z
    .object({ ...alvo, acao: z.literal("restaurar"), versao: z.number().int().min(1), nota })
    .strict(),
  z
    .object({ ...alvo, acao: z.literal("previa"), fonte: z.enum(["rascunho", "publicado"]) })
    .strict(),
]);
export type EntradaAtendimento = z.infer<typeof atendimentoSchema>;

// ---------------------------------------------------------------- respostas do gateway
export type Parte = "perfil" | "comportamentos";
export type Origem = "plataforma" | "segmento" | "empresa" | "agente";
export type CampoEsquema = {
  tipo: string;
  padrao?: Json;
  editavel: boolean;
  disponivel?: boolean;
  grupo?: string;
  min?: number;
  max?: number;
  linhas?: number;
  opcoes?: string[];
  fixos?: string[];
  acoes?: string[];
  max_itens?: number;
  opcional?: boolean;
};
export type Esquema = Record<Parte, Record<string, CampoEsquema>>;
export type Valores = Record<Parte, Record<string, Json>>;
export type Efetivo = Valores & { origem: Record<Parte, Record<string, Origem>> };
export type Trecho = { campo: string; motivo: string; trecho: string };
export type Alteracao = { campo: string; antes: Json; depois: Json };
export type Visao = {
  escopo: "empresa" | "agente";
  segmento: string | null;
  versao_publicada: number;
  publicado_em: string | null;
  publicado_por: string | null;
  perfil_versao: string;
  publicado: Valores;
  personalizado: Record<Parte, string[]>;
  efetivo: Efetivo;
  rascunho: {
    baseado_em: number;
    desatualizado: boolean;
    atualizado_em: string;
    atualizado_por: string;
    perfil: Record<string, Json>;
    comportamentos: Record<string, Json>;
    efetivo: Efetivo;
    alteracoes: Alteracao[];
    bloqueios: Trecho[];
    avisos: Trecho[];
  } | null;
  esquema: Esquema;
  pode_editar: boolean;
};
export type ResumoVersao = {
  versao: number;
  publicado_em: string;
  publicado_por: string;
  nota: string | null;
  origem: "publicacao" | "restauracao" | "alteracao_direta" | string;
  restaurada_de: number | null;
  campos_alterados: string[];
};
export type DetalheVersao = ResumoVersao & Valores & { alteracoes: Alteracao[] };
export type Previa = {
  fonte: "rascunho" | "publicado";
  perfil_versao: string;
  perfil_atendimento: Record<string, Json>;
};
/** Erro já traduzido pelo servidor do painel. */
export type ErroAtendimento = {
  status: number;
  mensagem: string;
  motivo?: string;
  campos?: { campo: string; motivo: string }[];
  bloqueios?: Trecho[];
  avisos?: Trecho[];
  versao_publicada?: number;
};
export type ResultadoAtendimento<T = Json> =
  { ok: true; dados: T } | { ok: false; erro: ErroAtendimento };

// ---------------------------------------------------------------- textos da tela
/** Rótulos conhecidos. Campo novo do gateway aparece com o nome derivado da chave. */
export const ROTULO_CAMPO: Record<string, string> = {
  nome_atendente: "Nome do atendente",
  apresentacao_inicial: "Se apresenta na primeira mensagem",
  tom: "Tom",
  emojis: "Emojis",
  tamanho_respostas: "Tamanho das respostas",
  tratamento: "Tratamento",
  pedir_nome: "Pede o nome do cliente",
  sugestoes: "Sugestões",
  regras_da_casa: "Regras da casa",
  assuntos_proibidos: "Assuntos proibidos",
  motivos_transferencia: "Quando transferir para a equipe",
  mensagem_boas_vindas: "Boas-vindas",
  mensagem_despedida: "Despedida",
  nome_empresa: "Nome da empresa",
  descricao_negocio: "Descrição do negócio",
  debounce_s: "Espera por mais mensagens (s)",
  debounce_curto_s: "Espera curta (s)",
  debounce_incompleta_s: "Espera de frase incompleta (s)",
  debounce_palavras: "Palavras para espera curta",
  max_wait_s: "Espera máxima (s)",
  media_wait_s: "Espera por áudio e imagem (s)",
  refazer_turno: "Refazer a resposta quando chega mensagem nova",
  history_turns: "Mensagens de histórico enviadas ao agente",
  acoes_recentes_min: "Ações recentes consideradas (min)",
  slow_notice_s: "Aviso de demora após (s)",
  aviso_demora: "Texto do aviso de demora",
  aviso_demora_janela_s: "Intervalo mínimo entre avisos de demora (s)",
  fallback: "Mensagem de falha",
  botoes_interativos: "Botões e listas",
  pause_minutes: "Pausa do bot ao assumir (min)",
  encerrar_vazia_min: "Encerrar conversa parada (min)",
  carrinho_expira_h: "Carrinho expira em (h)",
  reacoes: "Reações",
  reacoes_emojis: "Emojis de reação",
  reacoes_max_dia: "Reações por conversa por dia",
  fora_do_horario: "Fora do horário",
  fora_do_horario_mensagem: "Mensagem fora do horário",
  fora_do_horario_aceita_agendado: "Aceita pedido agendado",
  transbordo_alerta: "Telefone de alerta da equipe",
  transbordo_horario_equipe: "Horário da equipe",
  transbordo_fora_do_horario: "Mensagem com a equipe fora do horário",
  send_mode: "Envio",
  agente_mode: "Modo do agente",
  modo_piloto: "Modo piloto",
  contatos_permitidos: "Contatos do piloto",
  max_lotes_simultaneos: "Lotes simultâneos",
  max_concorrencia: "Concorrência",
  max_msgs_por_minuto_contato: "Mensagens por minuto por contato",
  skyone_dominios_permitidos: "Domínios do Skyone",
  alerta_telefone: "Telefone de alerta (antigo)",
};
export const AJUDA_CAMPO: Record<string, string> = {
  nome_atendente: "Vazio: o agente não diz um nome.",
  regras_da_casa:
    "Preferências de atendimento da sua casa. Não mudam preços, prazos, regras de pedido nem as regras de segurança do sistema.",
  mensagem_boas_vindas:
    "O agente usa este texto como base e adapta ao que o cliente escreveu. O sistema não envia sozinho.",
  mensagem_despedida:
    "O agente usa este texto como base e adapta ao que o cliente escreveu. O sistema não envia sozinho.",
  pedir_nome:
    "Pergunta o nome uma vez e passa a usá-lo. Em Conversas ele aparece como “informado”.",
  sugestoes: "Leve: oferece um acompanhamento quando faz sentido.",
  assuntos_proibidos:
    "Recusar: o agente diz que não fala sobre isso. Transferir: passa para a equipe.",
  motivos_transferencia:
    "Motivo desligado: o agente diz que não consegue ajudar com aquilo e oferece o que pode.",
  botoes_interativos:
    "Até 3 opções viram botões; de 4 a 10, lista. Desligado: opções numeradas em texto.",
  aviso_demora: "Vazio: sem aviso.",
};
export const ROTULO_OPCAO: Record<string, string> = {
  formal: "Formal",
  equilibrado: "Equilibrado",
  descontraido: "Descontraído",
  nenhum: "Nenhum",
  moderado: "Moderado",
  bastante: "Bastante",
  curtas: "Curtas",
  medias: "Médias",
  voce: "Você",
  senhor_senhora: "Senhor/Senhora",
  desligado: "Desligado",
  leve: "Leve",
  on: "Ligado",
  off: "Desligado",
  atender: "Atender",
  so_avisar: "Só avisar",
  recusar: "Recusar",
  transferir: "Transferir",
  pediu_humano: "Cliente pediu uma pessoa",
  reclamacao: "Reclamação",
  pedido_para_confirmar: "Pedido que precisa de confirmação",
  pagamento: "Pagamento",
  restricao_alimentar: "Restrição alimentar ou alergia",
  evento_ou_encomenda: "Evento ou encomenda",
  fora_do_escopo: "Fora do escopo",
  assunto_proibido: "Assunto proibido",
  dry: "Teste (nada sai)",
  live: "Real",
  mock: "Simulado",
};
export const ROTULO_GRUPO: Record<string, string> = {
  ritmo: "Espera e ritmo",
  mensagens: "Mensagens do sistema",
  atendimento_humano: "Atendimento humano",
  pedidos: "Pedidos",
  reacoes: "Reações",
  fora_do_horario: "Fora do horário",
  transbordo: "Transbordo para a equipe",
  operacao: "Operação",
};
export const ROTULO_ORIGEM: Record<string, string> = {
  plataforma: "Padrão da plataforma",
  segmento: "Padrão do segmento",
  empresa: "Da empresa",
  agente: "Do agente",
};
export const ROTULO_SEGMENTO: Record<string, string> = {
  delivery_restaurante: "Delivery de restaurante",
  atendente_delivery: "Atendente de delivery",
  assistente_generico: "Assistente genérico",
};
export const MOTIVO_CAMPO: Record<string, string> = {
  opcao: "Opção inválida.",
  tipo: "Valor em formato inválido.",
  tamanho: "Tamanho fora do limite.",
  linhas: "Linhas demais.",
  caractere: "Tem caracteres não permitidos.",
  contato_ou_link: "Sem link, e-mail ou telefone.",
  item: "Algum item está inválido (assunto de 3 a 80 caracteres e uma ação).",
  quantidade: "Itens demais.",
  repetido: "Há itens repetidos.",
  valor: "Valor fora do permitido.",
  campo_desconhecido: "Campo desconhecido pelo gateway.",
  so_plataforma: "Só a plataforma altera este campo.",
};
export const MOTIVO_BLOQUEIO: Record<string, string> = {
  ignorar_instrucoes: "Manda ignorar instruções",
  esquecer_instrucoes: "Manda esquecer instruções",
  formato_de_resposta: "Muda o formato da resposta",
  trocar_de_papel: "Troca o papel do agente",
  prompt_do_sistema: "Fala do prompt do sistema",
  dados_sensiveis: "Pede dados sensíveis (senha ou cartão)",
};
export const MOTIVO_AVISO: Record<string, string> = {
  parece_instrucao: "Parece uma instrução ao sistema",
  parece_papel: "Parece definir o papel do agente",
  dado_sensivel: "Menciona dado sensível",
  link: "Tem link",
};
export const ROTULO_ORIGEM_VERSAO: Record<string, string> = {
  publicacao: "Publicação",
  restauracao: "Restauração",
  alteracao_direta: "Alteração direta",
};

function humanizar(chave: string) {
  const t = chave.replace(/_/g, " ").trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : chave;
}
export function rotuloCampo(campo: string) {
  return ROTULO_CAMPO[campo] ?? humanizar(campo);
}
export function rotuloOpcao(opcao: string) {
  return ROTULO_OPCAO[opcao] ?? humanizar(opcao);
}
export function rotuloGrupo(grupo: string | undefined) {
  return grupo ? (ROTULO_GRUPO[grupo] ?? humanizar(grupo)) : "Outros";
}
export function rotuloSegmento(segmento: string | null | undefined) {
  return segmento ? (ROTULO_SEGMENTO[segmento] ?? humanizar(segmento)) : "Sem segmento";
}
/** "perfil.tom" → "Tom"; "perfil.assuntos_proibidos[2]" → "Assuntos proibidos (item 3)". */
export function rotuloCaminho(caminho: string) {
  const [, resto = caminho] = caminho.split(/\.(.*)/s);
  const m = /^([^[]+)(?:\[(\d+)\])?$/.exec(resto);
  if (!m) return humanizar(resto);
  return rotuloCampo(m[1]!) + (m[2] !== undefined ? ` (item ${Number(m[2]) + 1})` : "");
}

// ---------------------------------------------------------------- funções da tela
/** Campo do erro sem o índice: "perfil.assuntos_proibidos[2]" → "perfil.assuntos_proibidos". */
export function chaveCampo(caminho: string) {
  return caminho.replace(/\[\d+\]$/, "");
}
export function campoSoLeitura(c: CampoEsquema) {
  return c.tipo === "so_plataforma" || c.grupo === "operacao";
}
export function campoDisponivel(c: CampoEsquema) {
  return c.disponivel !== false;
}

/** Campos de uma parte do esquema, na ordem do gateway, agrupados (perfil não tem grupo). */
export function gruposDoEsquema(
  esquema: Esquema,
  parte: Parte,
  /** MULTI1-a: esconde comportamentos de pedidos quando o módulo não está em uso. */
  ocultarCampos?: ReadonlySet<string> | readonly string[],
) {
  const ocultos = ocultarCampos
    ? ocultarCampos instanceof Set
      ? ocultarCampos
      : new Set(ocultarCampos)
    : null;
  const grupos: { grupo: string; campos: [string, CampoEsquema][] }[] = [];
  for (const [campo, def] of Object.entries(esquema[parte] ?? {})) {
    if (ocultos?.has(campo)) continue;
    const grupo = parte === "perfil" ? "perfil" : (def.grupo ?? "outros");
    const g = grupos.find((x) => x.grupo === grupo);
    if (g) g.campos.push([campo, def]);
    else grupos.push({ grupo, campos: [[campo, def]] });
  }
  return grupos;
}

export type Edicoes = Record<Parte, Record<string, Json>>;
export const SEM_EDICOES: Edicoes = { perfil: {}, comportamentos: {} };
export function contarEdicoes(e: Edicoes) {
  return Object.keys(e.perfil).length + Object.keys(e.comportamentos).length;
}

/**
 * Situação de um campo para a tela: valor mostrado, origem, se é personalizado neste escopo
 * e se está no rascunho. O rascunho, quando existe, é o que a pessoa está editando.
 */
export function situacaoCampo(v: Visao, parte: Parte, campo: string, edicoes: Edicoes) {
  const aqui = v.escopo;
  const efetivo = v.rascunho?.efetivo ?? v.efetivo;
  const editado = Object.hasOwn(edicoes[parte], campo);
  const noRascunho = Boolean(v.rascunho && Object.hasOwn(v.rascunho[parte] ?? {}, campo));
  const origem = efetivo.origem?.[parte]?.[campo] ?? "plataforma";
  let personalizado: boolean;
  if (editado) personalizado = edicoes[parte][campo] !== null;
  else if (noRascunho) personalizado = v.rascunho![parte][campo] !== null;
  else personalizado = origem === aqui;
  const alterado = Boolean(v.rascunho?.alteracoes.some((a) => a.campo === `${parte}.${campo}`));
  return {
    valor: (editado ? edicoes[parte][campo] : efetivo[parte]?.[campo]) ?? null,
    valorPublicado: v.efetivo[parte]?.[campo] ?? null,
    origem,
    personalizado,
    editado,
    noRascunho: noRascunho && alterado,
  };
}

/** Corpo do PUT parcial: só o que foi mexido (null = voltar a herdar). */
export function corpoRascunho(v: Visao, edicoes: Edicoes) {
  return {
    baseado_em: v.rascunho?.baseado_em ?? v.versao_publicada,
    ...(Object.keys(edicoes.perfil).length ? { perfil: edicoes.perfil } : {}),
    ...(Object.keys(edicoes.comportamentos).length
      ? { comportamentos: edicoes.comportamentos }
      : {}),
  };
}

/** Erros, bloqueios e avisos agrupados pelo campo (sem índice). */
export function porCampo<T extends { campo: string }>(itens: T[] | undefined) {
  const mapa = new Map<string, T[]>();
  for (const i of itens ?? []) {
    const k = chaveCampo(i.campo);
    mapa.set(k, [...(mapa.get(k) ?? []), i]);
  }
  return mapa;
}

/** Texto dividido em pedaços, com os trechos indicados pelo gateway marcados. */
export function marcarTrechos(texto: string, trechos: string[]) {
  const faixas: [number, number][] = [];
  for (const t of trechos) {
    if (!t) continue;
    let i = texto.indexOf(t);
    while (i >= 0) {
      faixas.push([i, i + t.length]);
      i = texto.indexOf(t, i + t.length);
    }
  }
  faixas.sort((a, b) => a[0] - b[0]);
  const partes: { texto: string; marcado: boolean }[] = [];
  let pos = 0;
  for (const [ini, fim] of faixas) {
    if (fim <= pos) continue;
    const de = Math.max(ini, pos);
    if (de > pos) partes.push({ texto: texto.slice(pos, de), marcado: false });
    partes.push({ texto: texto.slice(de, fim), marcado: true });
    pos = fim;
  }
  if (pos < texto.length) partes.push({ texto: texto.slice(pos), marcado: false });
  return partes;
}

/** Valor legível para prévia, histórico e operação. */
export function textoValor(valor: Json | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "string") return ROTULO_OPCAO[valor] ?? valor;
  if (typeof valor === "number") return String(valor).replace(".", ",");
  if (Array.isArray(valor)) {
    if (!valor.length) return "Nenhum";
    return valor
      .map((x) =>
        x && typeof x === "object" && !Array.isArray(x) && "assunto" in x
          ? `${String(x["assunto"])} (${rotuloOpcao(String(x["acao"]))})`
          : textoValor(x),
      )
      .join(", ");
  }
  return JSON.stringify(valor);
}
