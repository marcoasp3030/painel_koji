/**
 * LOTE1-a: envio de notas em lote (PDF/XML/ZIP).
 * Rótulos e conferências do painel; a chamada HTTP fica no servidor.
 */
import { z } from "zod";
import { empresa, idRecurso } from "./esquemas";
import { LIMITE_ARQUIVO_BYTES } from "./documentos";

/** Polling do progresso enquanto houver arquivo na fila. */
export const INTERVALO_PROGRESSO_LOTE_MS = 3_000;

export const TEXTO_AJUDA_LOTES =
  "As notas são lidas uma por vez, sem atrasar os atendimentos. PDF escaneado aparece como 'sem texto'. XML de NFS-e nacional ainda não é aceito; envie o PDF.";

export const ACEITA_ARQUIVO_LOTE = ".pdf,.xml,.zip";

const EXTENSAO_LOTE = new Set(["pdf", "xml", "zip"]);

/** null quando o arquivo pode seguir. A frase é a que a tela mostra. */
export function mensagemArquivoLoteInvalido(nome: string, tamanho: number) {
  if (tamanho <= 0) return "O arquivo está vazio.";
  if (tamanho > LIMITE_ARQUIVO_BYTES) return "O arquivo é grande demais.";
  const extensao = nome.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSAO_LOTE.has(extensao)) {
    return "Formato não aceito. Use PDF, XML ou ZIP.";
  }
  return null;
}

export const ESTADOS_LOTE = ["aberto", "lendo", "concluido", "expirado", "apagado"] as const;
export type EstadoLote = (typeof ESTADOS_LOTE)[number];

export const ROTULO_ESTADO_LOTE: Record<
  string,
  { rotulo: string; tom: "sucesso" | "alerta" | "perigo" | "roxo" | "neutro" }
> = {
  aberto: { rotulo: "Aberto", tom: "roxo" },
  lendo: { rotulo: "Lendo", tom: "alerta" },
  concluido: { rotulo: "Concluído", tom: "sucesso" },
  expirado: { rotulo: "Expirado", tom: "neutro" },
  apagado: { rotulo: "Apagado", tom: "neutro" },
};

export const ESTADOS_ARQUIVO_LOTE = [
  "na_fila",
  "lido",
  "sem_texto",
  "recusado",
  "falhou",
  "duplicado",
] as const;
export type EstadoArquivoLote = (typeof ESTADOS_ARQUIVO_LOTE)[number];

export const ROTULO_ESTADO_ARQUIVO_LOTE: Record<
  string,
  { rotulo: string; tom: "sucesso" | "alerta" | "perigo" | "roxo" | "neutro" }
> = {
  na_fila: { rotulo: "Na fila", tom: "roxo" },
  lido: { rotulo: "Lido", tom: "sucesso" },
  sem_texto: { rotulo: "Sem texto", tom: "alerta" },
  recusado: { rotulo: "Recusado", tom: "perigo" },
  falhou: { rotulo: "Falhou", tom: "perigo" },
  duplicado: { rotulo: "Duplicado", tom: "neutro" },
};

/** Motivos de recusa do envio e dos itens do ZIP (contrato LOTE1-a). */
export const ROTULO_MOTIVO_LOTE: Record<string, string> = {
  tipo_nao_aceito: "Formato não aceito. Use PDF, XML ou ZIP.",
  xml_nao_e_nfe: "Este XML não é uma NF-e/NFC-e. Envie o XML da nota ou o PDF.",
  zip_invalido: "ZIP inválido.",
  zip_vazio: "O ZIP está vazio.",
  zip_protegido: "ZIP com senha.",
  zip_entradas_demais: "O ZIP tem entradas demais.",
  zip_grande_demais: "O ZIP descompactado é grande demais.",
  zip_caminho_invalido: "Entrada do ZIP com caminho inválido.",
  zip_link: "Entrada do ZIP é um link simbólico.",
  zip_taxa_de_compressao: "Taxa de compressão suspeita no ZIP.",
  zip_entrada_ilegivel: "Não foi possível ler uma entrada do ZIP.",
  tamanho: "O arquivo é grande demais.",
  limite_do_lote: "O limite do lote foi atingido.",
  lote_fechado: "Este lote não aceita mais arquivos.",
  lote_vazio: "Inclua ao menos um arquivo válido antes de fechar.",
  arquivo_repetido: "Este arquivo já está no lote.",
  capacidade_desligada: "A capacidade de documentos está desligada neste agente.",
  agente_inativo: "Este agente está inativo.",
  empresa_inativa: "A empresa está inativa.",
  multipart_invalido: "Não foi possível ler o arquivo enviado.",
  expirado: "O prazo do lote expirou.",
  lote_apagado: "O lote foi apagado.",
};

export type ContadoresArquivosLote = {
  total: number;
  na_fila: number;
  lido: number;
  sem_texto: number;
  recusado: number;
  falhou: number;
  duplicado: number;
};

export type LoteProgresso = {
  lote_id: string;
  agente_id: string;
  nome: string | null;
  estado: string;
  origem?: string;
  criado_por?: string | null;
  criado_em: string | null;
  fechado_em?: string | null;
  concluido_em?: string | null;
  expira_em?: string | null;
  bytes_total?: number;
  arquivos: ContadoresArquivosLote;
  notas: number;
  estimativa_s: number;
  limites?: Record<string, unknown>;
};

export type ArquivoLoteResumo = {
  arquivo_id: string;
  anexo_id: string | null;
  nome: string;
  zip: string | null;
  formato: string | null;
  tamanho_bytes: number | null;
  estado: string;
  motivo: string | null;
  criado_em: string | null;
  lido_em: string | null;
  tipo_documento: string | null;
  paginas: number | null;
};

export type ArquivoLoteEnvio = {
  arquivo_id: string;
  nome: string;
  zip: string | null;
  estado: string;
  motivo: string | null;
};

export type RespostaEnvioArquivoLote = {
  arquivos: ArquivoLoteEnvio[];
  lote: LoteProgresso;
};

export type CampoNotaLote = {
  valor?: unknown;
  confianca?: string;
  fonte?: string;
};

export type NotaLote = {
  tipo_documento: string | null;
  fonte: "xml" | "pdf" | string;
  campos: Record<string, CampoNotaLote>;
  avisos: string[];
  arquivos: {
    arquivo_id: string;
    anexo_id: string;
    nome: string;
    formato: string | null;
    zip: string | null;
  }[];
};

export const ROTULO_AVISO_NOTA: Record<string, string> = {
  sem_chave_de_juncao: "Sem chave para juntar PDF e XML",
  nota_duplicada: "Mais de um PDF ou XML da mesma nota",
  pdf_diverge_do_xml: "PDF diverge do XML",
};

export const idLote = z.string().regex(/^lot_[0-9a-f]{24}$/);

const base = z.object({ empresa });

export const lotesSchema = z.discriminatedUnion("acao", [
  base.extend({
    acao: z.literal("listar"),
    agente_id: idRecurso.optional(),
    estado: z.string().max(40).optional(),
    cursor: z.string().max(80).optional(),
  }),
  base.extend({
    acao: z.literal("criar"),
    agente_id: idRecurso,
    nome: z.string().trim().max(120).optional(),
  }),
  base.extend({
    acao: z.literal("ver"),
    lote_id: idLote,
  }),
  base.extend({
    acao: z.literal("enviar"),
    lote_id: idLote,
    nome: z.string().trim().min(1).max(180),
    tipo: z.string().max(120),
    base64: z
      .string()
      .min(1)
      .max(Math.ceil(LIMITE_ARQUIVO_BYTES / 3) * 4 + 8),
  }),
  base.extend({
    acao: z.literal("arquivos"),
    lote_id: idLote,
    estado: z.string().max(40).optional(),
    cursor: z.string().max(80).optional(),
  }),
  base.extend({
    acao: z.literal("notas"),
    lote_id: idLote,
  }),
  base.extend({
    acao: z.literal("fechar"),
    lote_id: idLote,
  }),
  base.extend({
    acao: z.literal("apagar"),
    lote_id: idLote,
  }),
]);

export type EntradaLotes = z.infer<typeof lotesSchema>;
