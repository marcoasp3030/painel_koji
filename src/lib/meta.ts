/**
 * META1-a: WhatsApp oficial (Meta).
 * Rótulos e conferências do painel; a chamada HTTP fica no servidor.
 */

export type CredenciaisMeta = {
  configurado: boolean;
  app_id: string | null;
  nome_do_app: string | null;
  webhook_url: string;
  versao_graph?: string | null;
  atualizado_por: string | null;
  atualizado_em: string | null;
};

export type MetaDoCanal = {
  numero: string | null;
  nome_verificado: string | null;
  qualidade: string | null;
};

export type SituacaoMetaCanal =
  | "conectado"
  | "token_invalido"
  | "credenciais_ausentes"
  | "meta_indisponivel"
  | string;

export type ConferenciaMetaCanal = {
  canal_id: string;
  phone_number_id: string | null;
  situacao: SituacaoMetaCanal;
  numero?: string | null;
  nome_verificado?: string | null;
  qualidade?: string | null;
  app_configurado: boolean;
};

export const TEXTO_AJUDA_META =
  "Na Meta: WhatsApp → Configuração → Webhook: cole o endereço e o mesmo token de verificação; assine o campo messages.";

/** Token de verificação: 32 caracteres [A-Za-z0-9_-], gerado no navegador. */
export function gerarTokenVerificacaoMeta(tamanho = 32) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  let saida = "";
  for (let i = 0; i < tamanho; i += 1) {
    saida += alfabeto[bytes[i]! % alfabeto.length]!;
  }
  return saida;
}

export function textoStatusCredenciaisMeta(c: CredenciaisMeta): string {
  if (!c.configurado) return "Não configurado";
  const app = (c.nome_do_app || "").trim() || "app";
  const id = (c.app_id || "").trim();
  const base = id ? `Configurado — ${app} (${id})` : `Configurado — ${app}`;
  const quem = (c.atualizado_por || "").trim();
  const quando = dataCurtaMeta(c.atualizado_em);
  if (quem && quando) return `${base}, alterado por ${quem} em ${quando}`;
  if (quem) return `${base}, alterado por ${quem}`;
  return base;
}

function dataCurtaMeta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export function rotuloQualidadeMeta(q: string | null | undefined) {
  if (!q) return null;
  if (q === "GREEN") return "qualidade alta";
  if (q === "YELLOW") return "qualidade média";
  if (q === "RED") return "qualidade baixa";
  return `qualidade ${q}`;
}

/** Ex.: 5511999999999 → +55 11 99999-9999 */
export function formatarNumeroMeta(numero: string | null | undefined) {
  if (!numero) return null;
  const d = numero.replace(/\D/g, "");
  if (/^55\d{2}9\d{8}$/.test(d)) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (/^55\d{10}$/.test(d)) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return d.startsWith("55") ? `+${d}` : numero;
}

export function textoConectadoMeta(m: MetaDoCanal | null | undefined) {
  if (!m) return null;
  const numero = formatarNumeroMeta(m.numero) ?? m.numero ?? "—";
  const nome = (m.nome_verificado || "").trim() || "Sem nome verificado";
  const qualidade = rotuloQualidadeMeta(m.qualidade);
  return qualidade
    ? `Conectado: ${numero} — ${nome} — ${qualidade}`
    : `Conectado: ${numero} — ${nome}`;
}

export function avisoSituacaoMeta(s: SituacaoMetaCanal) {
  if (s === "conectado") return null;
  if (s === "token_invalido") return "token inválido";
  if (s === "credenciais_ausentes") return "credenciais ausentes";
  if (s === "meta_indisponivel") return "Meta indisponível";
  return s.replace(/_/g, " ");
}

/**
 * Mensagem para a tela: motivos do contrato META1-a com texto fixo.
 */
export function mensagemErroMeta(erro: {
  mensagem?: string | null;
  status?: number;
  detalhes?: Record<string, unknown> | null;
}): string {
  const motivo = erro.detalhes?.["motivo"];
  const campo = erro.detalhes?.["campo"];
  if (erro.status === 403 && motivo === "papel_sem_credencial") {
    return "Trocar as credenciais da Meta exige a chave de plataforma no servidor do painel.";
  }
  if (erro.status === 400 && motivo === "credenciais_recusadas") {
    return "A Meta recusou estas credenciais. Nada foi gravado.";
  }
  if (erro.status === 502 || motivo === "meta_indisponivel") {
    return "A Meta não respondeu. Tente de novo em instantes.";
  }
  if (erro.status === 409 && campo === "credenciais.phone_number_id") {
    return "Este número já está ligado a outro canal.";
  }
  if (erro.status === 400 && motivo === "formato") {
    if (campo === "app_id") return "Informe um ID do app válido.";
    if (campo === "app_secret") return "Informe a chave secreta do app.";
    if (campo === "verify_token") return "O token de verificação precisa ter ao menos 16 caracteres.";
    if (typeof campo === "string" && campo.startsWith("credenciais.")) {
      return "Confira o ID do número, o ID da conta e o token.";
    }
    return "Confira os campos informados.";
  }
  const m = erro.mensagem?.trim();
  return m || "Não foi possível concluir.";
}

export type StatusProvedor = "enviada" | "entregue" | "lida" | "falhou" | string;

export function marcaStatusProvedor(status: string | null | undefined): {
  texto: string;
  tom: "neutro" | "ok" | "lida" | "falhou";
} | null {
  if (!status) return null;
  if (status === "enviada") return { texto: "✓", tom: "neutro" };
  if (status === "entregue") return { texto: "✓✓", tom: "ok" };
  if (status === "lida") return { texto: "✓✓", tom: "lida" };
  if (status === "falhou") return { texto: "⚠", tom: "falhou" };
  return { texto: status, tom: "neutro" };
}
