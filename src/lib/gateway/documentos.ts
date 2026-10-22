/**
 * Documentos recebidos (ARQ1-a1 / ARQ1-a3) e chaves de formulário.
 * Rótulos, filtros e o formato que a tela mostra. A chamada HTTP fica no servidor.
 */
import { z } from "zod";
import { empresa, idRecurso } from "./esquemas";
import type { Json } from "./tipos";

export const ESTADOS_DOCUMENTO = [
  "processando",
  "pronto",
  "sem_texto",
  "rejeitado",
  "falhou",
] as const;
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

export const ROTULO_ESTADO_DOCUMENTO: Record<
  string,
  { rotulo: string; tom: "sucesso" | "alerta" | "perigo" | "roxo" | "neutro" }
> = {
  processando: { rotulo: "Processando", tom: "roxo" },
  pronto: { rotulo: "Pronto", tom: "sucesso" },
  sem_texto: { rotulo: "Sem texto", tom: "alerta" },
  rejeitado: { rotulo: "Rejeitado", tom: "perigo" },
  falhou: { rotulo: "Falhou", tom: "perigo" },
};

export const ROTULO_FORMATO: Record<string, string> = {
  pdf: "PDF",
  xml: "XML",
  jpg: "JPG",
  png: "PNG",
  webp: "WEBP",
};

export const ROTULO_TIPO_DOCUMENTO: Record<string, string> = {
  boleto: "Boleto",
  nfe: "NF-e",
  nfce: "NFC-e",
  nfse: "NFS-e",
  pix: "PIX",
  comprovante: "Comprovante",
  outro: "Outro",
};

/** Confiança do campo, como o gateway marca (ARQ1-a3). */
export const SELO_CONFIANCA: Record<
  string,
  { rotulo: string; tom: "sucesso" | "roxo" | "alerta" }
> = {
  validado: { rotulo: "validado", tom: "sucesso" },
  lido_do_texto: { rotulo: "lido do texto", tom: "roxo" },
  a_conferir: { rotulo: "a conferir", tom: "alerta" },
};

export const ROTULO_MOTIVO_DOCUMENTO: Record<string, string> = {
  ocr_necessario: "PDF escaneado: ainda precisa de leitura de imagem",
  imagem_sem_ocr: "Foto: a leitura de imagem ainda não está ligada",
  pdf_conteudo_ativo: "PDF com conteúdo ativo, recusado",
  pdf_protegido: "PDF com senha",
  pdf_invalido: "PDF inválido",
  paginas_demais: "Páginas demais",
  xml_invalido: "XML inválido",
  xml_nao_e_nfe: "XML que não é nota fiscal",
  leitor_indisponivel: "Leitor indisponível",
};

const ORIGEM = /^https?:\/\/[a-z0-9.-]+(:[0-9]{1,5})?$/;

/** Site permitido da chave de formulário: só a origem, sem caminho. */
export function normalizarOrigem(valor: string) {
  const limpa = valor.trim().toLowerCase().replace(/\/+$/, "");
  return ORIGEM.test(limpa) ? limpa : null;
}

export function origensDoTexto(texto: string) {
  const linhas = texto
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const origens: string[] = [];
  const invalidas: string[] = [];
  for (const linha of linhas) {
    const ok = normalizarOrigem(linha);
    if (!ok) invalidas.push(linha);
    else if (!origens.includes(ok)) origens.push(ok);
  }
  return { origens, invalidas };
}

export type CampoDocumento = {
  valor: Json;
  confianca: string;
  fonte?: string;
};

export type DocumentoResumo = {
  id: string;
  agente_id: string | null;
  conversation_id: string | null;
  origem: string | null;
  modo: string | null;
  nome: string | null;
  formato: string | null;
  tamanho_bytes: number | null;
  estado: string;
  motivo: string | null;
  paginas: number | null;
  tipo_documento: string | null;
  referencia: string | null;
  criado_em: string | null;
  processado_em: string | null;
  expira_em: string | null;
  apagado_em: string | null;
};

export type PaginaDocumento = {
  pagina: number;
  origem?: string;
  texto?: string;
  caracteres?: number;
  tabelas?: { id?: string; linhas: string[][] }[] | number;
};

export type DocumentoDetalhe = DocumentoResumo & {
  conteudo: {
    paginas: PaginaDocumento[];
    campos: Record<string, CampoDocumento>;
    avisos: Json[];
    parcial?: boolean;
  } | null;
  verificacao_pagamento: Json;
};

export type TextoPagina = {
  anexo_id: string;
  pagina: number;
  origem: string | null;
  texto: string;
  tabelas: { id: string; linhas: string[][] }[];
};

export type ChaveFormulario = {
  id: string;
  nome: string;
  agente_id: string;
  limite_por_minuto: number;
  max_bytes: number | null;
  tipos_aceitos: string[] | null;
  modos: string[];
  origens_permitidas: string[];
  expira_em: string | null;
  criado_em: string;
  ultimo_uso_em: string | null;
  revogada_em: string | null;
  revogada_por: string | null;
};

export type FiltroDocumentos = {
  estado: string;
  tipo: string;
  desde: string;
  ate: string;
};

export const FILTRO_DOCUMENTOS_VAZIO: FiltroDocumentos = {
  estado: "",
  tipo: "",
  desde: "",
  ate: "",
};

const FUSO = "America/Sao_Paulo";

/** Dia civil em Brasília, no formato do input date (AAAA-MM-DD). */
export function diaBrasilia(iso: string | null | undefined) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(data);
}

export function dataHoraBrasilia(iso: string | null | undefined) {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO,
  });
}

/** Estado vai ao gateway. Tipo e período filtram o que já chegou, pelo dia de Brasília. */
export function filtrarDocumentos(itens: DocumentoResumo[], filtro: FiltroDocumentos) {
  return itens.filter((item) => {
    if (filtro.tipo && (item.tipo_documento ?? "") !== filtro.tipo) return false;
    const dia = diaBrasilia(item.criado_em);
    if (filtro.desde && (!dia || dia < filtro.desde)) return false;
    if (filtro.ate && (!dia || dia > filtro.ate)) return false;
    return true;
  });
}

export function rotuloTipo(tipo: string | null | undefined) {
  if (!tipo) return "Sem tipo";
  return ROTULO_TIPO_DOCUMENTO[tipo] ?? tipo;
}

export function textoValorCampo(valor: Json): string {
  if (valor == null) return "—";
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
    return String(valor);
  }
  if (Array.isArray(valor)) {
    return valor
      .map((item) =>
        typeof item === "string" || typeof item === "number" ? String(item) : JSON.stringify(item),
      )
      .join("\n");
  }
  return JSON.stringify(valor);
}

const alvo = { empresa, agente: idRecurso.optional() };
export const documentosSchema = z.discriminatedUnion("acao", [
  z
    .object({
      ...alvo,
      acao: z.literal("listar"),
      estado: z.string().max(40).optional(),
      cursor: z.string().max(80).nullish(),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("detalhe"), id: idRecurso }).strict(),
  z
    .object({
      ...alvo,
      acao: z.literal("texto"),
      id: idRecurso,
      pagina: z.number().int().min(1).max(500),
    })
    .strict(),
  z.object({ ...alvo, acao: z.literal("baixar"), id: idRecurso }).strict(),
  z.object({ ...alvo, acao: z.literal("apagar"), id: idRecurso }).strict(),
]);

const origem = z
  .string()
  .trim()
  .max(200)
  .transform((v) => normalizarOrigem(v) ?? v)
  .refine(
    (v) => ORIGEM.test(v),
    "Use o endereço do site, como https://loja.exemplo.com.br, sem caminho.",
  );

export const chaveFormularioSchema = z.discriminatedUnion("acao", [
  z.object({ empresa, acao: z.literal("listar") }).strict(),
  z
    .object({
      empresa,
      acao: z.literal("criar"),
      nome: z.string().trim().min(1).max(200),
      agente_id: idRecurso,
      limite_por_minuto: z.number().int().min(1).max(600),
      origens: z.array(origem).max(20),
    })
    .strict(),
  z.object({ empresa, acao: z.literal("revogar"), id: idRecurso }).strict(),
]);

export type EntradaDocumentos = z.infer<typeof documentosSchema>;
export type EntradaChaveFormulario = z.infer<typeof chaveFormularioSchema>;
