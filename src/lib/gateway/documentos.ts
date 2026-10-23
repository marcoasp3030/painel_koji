/**
 * Documentos recebidos (ARQ1-a1 / ARQ1-a3) e chaves de formulário.
 * Rótulos, filtros e o formato que a tela mostra. A chamada HTTP fica no servidor.
 */
import { z } from "zod";
import { isoParaDataBr } from "@/lib/data-hora";
import { empresa, idRecurso } from "./esquemas";
import type { Json } from "./tipos";

/** Teto do simulador: o padrão da capacidade no gateway também é 10 MB. */
export const LIMITE_ARQUIVO_BYTES = 10 * 1024 * 1024;

/** O cartão consulta o anexo a cada 2 s e desiste aos 30 s. */
export const INTERVALO_CONSULTA_ANEXO_MS = 2_000;
export const PRAZO_CONSULTA_ANEXO_MS = 30_000;
export const AVISO_AINDA_LENDO = "Ainda lendo, atualize em instantes";

/** XML que o gateway não reconhece como NF-e/NFC-e. */
export const AVISO_XML_FORA_DA_NOTA =
  "Este XML não é uma NF-e/NFC-e. Envie o XML da nota ou o PDF.";

const MARCA_NOTA_FISCAL = "portalfiscal.inf.br/nfe";

const EXTENSAO_DOCUMENTO = new Set(["pdf", "xml", "jpg", "jpeg", "png", "webp"]);

export const ACEITA_ARQUIVO = ".pdf,.xml,.jpg,.jpeg,.png,.webp";

/** null quando o arquivo pode seguir. A frase é a que a tela mostra. */
export function mensagemArquivoInvalido(nome: string, tamanho: number) {
  if (tamanho <= 0) return "O arquivo está vazio.";
  if (tamanho > LIMITE_ARQUIVO_BYTES) return "O arquivo é grande demais.";
  const extensao = nome.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSAO_DOCUMENTO.has(extensao)) {
    return "Formato não aceito. Use PDF, XML, JPG, PNG ou WEBP.";
  }
  return null;
}

/**
 * XML (começa com "<") sem a marca da NF-e/NFC-e. PDF e imagem passam batido:
 * o gateway reconhece esses formatos pela assinatura, não pelo nome.
 */
export function avisoXmlForaDaNota(trecho: string) {
  const cabeca = trecho.replace(/^\uFEFF/, "").trimStart();
  if (!cabeca.startsWith("<")) return null;
  if (cabeca.includes(MARCA_NOTA_FISCAL)) return null;
  return AVISO_XML_FORA_DA_NOTA;
}

/** true quando o cartão deve parar de consultar: estado final, ou 30 s de Processando. */
export function consultaDoAnexoDeveParar(inicioMs: number, agoraMs: number, estado: string) {
  if (estado !== "processando") return true;
  return agoraMs - inicioMs >= PRAZO_CONSULTA_ANEXO_MS;
}

/** "[anexo: boleto.pdf]\\ntexto" → nome e o texto opcional. Outra mensagem devolve null. */
export function lerAnexoDaMensagem(conteudo: string | null | undefined) {
  if (!conteudo) return null;
  const lido = /^\[anexo: ([^\]]+)\](?:\n([\s\S]*))?$/.exec(conteudo);
  if (!lido?.[1]) return null;
  return { nome: lido[1], texto: (lido[2] ?? "").trim() };
}

/** Liga cada mensagem `[anexo: nome]` ao documento da conversa, na ordem em que chegaram. */
export function associarDocumentosDaConversa<
  T extends { nome: string | null; criado_em: string | null },
>(mensagens: { conteudo: string | null }[], documentos: T[]) {
  const fila = [...documentos].sort((a, b) => (a.criado_em ?? "").localeCompare(b.criado_em ?? ""));
  return mensagens.map((mensagem) => {
    const lido = lerAnexoDaMensagem(mensagem.conteudo);
    if (!lido) return null;
    const indice = fila.findIndex((doc) => doc.nome === lido.nome);
    if (indice < 0) return null;
    return fila.splice(indice, 1)[0] ?? null;
  });
}

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
  boleto_concessionaria: "Conta de consumo",
  nfe: "NF-e",
  nfce: "NFC-e",
  nfse: "NFS-e",
  pix: "PIX",
  pix_cobranca: "Cobrança Pix",
  comprovante: "Comprovante",
  comprovante_pix: "Comprovante PIX",
  outro: "Outro",
};

/** Nome técnico do campo → o que a pessoa lê. Sem a chave crua. */
export const ROTULO_CAMPO_DOCUMENTO: Record<string, string> = {
  valor: "Valor",
  vencimento: "Vencimento",
  beneficiario: "Beneficiário",
  beneficiario_nome: "Beneficiário",
  beneficiario_documento: "CNPJ do beneficiário",
  pagador: "Pagador",
  pagador_nome: "Pagador",
  pagador_documento: "Documento do pagador",
  linha_digitavel: "Linha digitável",
  codigo_barras: "Código de barras",
  banco: "Banco",
  chave_acesso: "Chave de acesso",
  emitente: "Emitente",
  emitente_nome: "Emitente",
  emitente_cnpj: "CNPJ do emitente",
  emitente_documento: "CNPJ do emitente",
  numero: "Número",
  serie: "Série",
  valor_total: "Valor total",
  itens: "Itens",
  id_transacao: "ID da transação",
  chave_pix: "Chave Pix",
  recebedor: "Recebedor",
  recebedor_nome: "Recebedor",
  data_hora: "Data e hora",
  destinatario_nome: "Destinatário",
  destinatario_documento: "Documento do destinatário",
  emissao: "Emissão",
  protocolo: "Protocolo",
  situacao: "Situação",
  modelo: "Modelo",
  ano_mes_emissao: "Ano e mês de emissão",
  uf: "UF",
  segmento: "Segmento",
  valor_referencia: "Valor de referência",
  instituicao_pagador: "Instituição do pagador",
  prestador_documento: "Documento do prestador",
  tomador_documento: "Documento do tomador",
  pix_brcode_chave: "Chave Pix",
  pix_brcode_valor: "Valor do Pix",
  pix_brcode_nome: "Nome no Pix",
  pix_brcode_cidade: "Cidade no Pix",
  pix_brcode_txid: "Identificador do Pix",
  brcode_chave: "Chave Pix",
  brcode_valor: "Valor",
  brcode_nome: "Nome",
  brcode_cidade: "Cidade",
  brcode_txid: "Identificador",
};

export const CAMPOS_COPIAR = [
  "linha_digitavel",
  "codigo_barras",
  "chave_acesso",
  "id_transacao",
] as const;

export const AVISO_PIX = "Pagamento não verificado: confira no extrato antes de dar baixa";

/** Valores que GET /anexos aceita em tipo_documento. "outro" inclui documento sem tipo. */
export const TIPOS_FILTRO_DOCUMENTO = [
  "boleto",
  "boleto_concessionaria",
  "nfe",
  "nfce",
  "nfse",
  "comprovante_pix",
  "pix_cobranca",
  "outro",
] as const;

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

/** `de` e `ate` são inclusivos. A rota recusa quando o início passa do fim. */
export function periodoDocumentosValido(filtro: FiltroDocumentos) {
  return !(filtro.desde && filtro.ate && filtro.desde > filtro.ate);
}

/** Query de GET /anexos: estado, tipo_documento, de e ate (AAAA-MM-DD, dia de Brasília). */
export function parametrosListaDocumentos(filtro: FiltroDocumentos, cursor?: string | null) {
  return {
    limite: 50,
    ...(filtro.estado ? { estado: filtro.estado } : {}),
    ...(filtro.tipo ? { tipo_documento: filtro.tipo } : {}),
    ...(filtro.desde ? { de: filtro.desde } : {}),
    ...(filtro.ate ? { ate: filtro.ate } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

export function rotuloTipo(tipo: string | null | undefined) {
  if (!tipo) return "Sem tipo";
  return ROTULO_TIPO_DOCUMENTO[tipo] ?? tipo;
}

export function rotuloCampoDocumento(nome: string) {
  return ROTULO_CAMPO_DOCUMENTO[nome] ?? nome.replace(/_/g, " ");
}

export function ehComprovantePix(tipo: string | null | undefined) {
  return tipo === "comprovante_pix" || tipo === "comprovante";
}

/** "2026-11-20T16:02:00Z" → "Apagado automaticamente em 20/11/2026" (dia de Brasília). */
export function textoExpira(iso: string | null | undefined) {
  const dia = diaBrasilia(iso);
  const br = isoParaDataBr(dia);
  return br ? `Apagado automaticamente em ${br}` : "";
}

const CAMPOS_DINHEIRO = new Set([
  "valor",
  "valor_total",
  "valor_referencia",
  "valor_unitario",
  "pix_brcode_valor",
  "brcode_valor",
]);
const CAMPOS_DATA = new Set(["vencimento", "emissao"]);
const CAMPOS_DATA_HORA = new Set(["data_hora"]);

/** "1234.56" ou "1.234,56" → "R$ 1.234,56". */
export function reaisDocumento(valor: string) {
  const limpo = valor.replace(/\s/g, "").replace(/^R\$/, "");
  if (!limpo) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  const n = Number(normal);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data lida do documento, sem deslocar o fuso. "2026-10-25T14:32" → "25/10/2026 14:32". */
export function dataHoraCampo(valor: string) {
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(valor);
  if (!local) return null;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(valor)) {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return null;
    const dia = new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(data);
    const hora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(data);
    return `${dia} ${hora}`;
  }
  return `${local[3]}/${local[2]}/${local[1]} ${local[4]}:${local[5]}`;
}

export type ItemNota = {
  descricao: string;
  quantidade: string | null;
  valor_unitario: string | null;
  valor_total: string | null;
};

export function itensNota(valor: Json): ItemNota[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null;
  const itens: ItemNota[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const o = item as Record<string, Json>;
    if (typeof o["descricao"] !== "string" || !o["descricao"]) return null;
    itens.push({
      descricao: o["descricao"],
      quantidade: o["quantidade"] == null ? null : String(o["quantidade"]),
      valor_unitario: o["valor_unitario"] == null ? null : String(o["valor_unitario"]),
      valor_total: o["valor_total"] == null ? null : String(o["valor_total"]),
    });
  }
  return itens;
}

export function apresentarCampo(nome: string, valor: Json): string {
  if (valor == null) return "—";
  if (typeof valor === "string" || typeof valor === "number") {
    const texto = String(valor);
    if (CAMPOS_DINHEIRO.has(nome) || nome.endsWith("_valor")) {
      const reais = reaisDocumento(texto);
      if (reais) return reais;
    }
    if (CAMPOS_DATA.has(nome)) {
      const data = isoParaDataBr(texto);
      if (data) return data;
    }
    if (CAMPOS_DATA_HORA.has(nome)) {
      const data = dataHoraCampo(texto);
      if (data) return data;
    }
    return texto;
  }
  return textoValorCampo(valor);
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
      tipo: z.enum(TIPOS_FILTRO_DOCUMENTO).optional(),
      desde: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      ate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
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
