/** Respostas rápidas do atendimento: contrato com o gateway e as regras puras do menu. */
import { z } from "zod";
import { empresa } from "./esquemas";

export const LIMITE_TEXTO_RESPOSTA = 2000;
export const REGRA_ATALHO = /^[a-z0-9][a-z0-9_-]{0,29}$/;

export type EscopoResposta = "equipe" | "pessoal";
export type RespostaRapida = {
  id: number;
  atalho: string;
  texto: string;
  escopo: EscopoResposta;
  usos: number;
  atualizado_em: string;
  /** Do gateway: esta sessão pode alterar e apagar. */
  editavel: boolean;
};
export type ListaRespostas = { itens: RespostaRapida[]; indisponivel?: boolean };

const atalho = z
  .string()
  .regex(REGRA_ATALHO, "Use letras minúsculas, números, - ou _, sem espaços.");
const texto = z
  .string()
  .trim()
  .min(1, "Escreva o texto da resposta.")
  .max(LIMITE_TEXTO_RESPOSTA, `Use até ${LIMITE_TEXTO_RESPOSTA} caracteres.`);
const id = z.number().int().positive();

export const respostasSchema = z.discriminatedUnion("acao", [
  z.object({ empresa, acao: z.literal("listar") }).strict(),
  z
    .object({
      empresa,
      acao: z.literal("criar"),
      atalho,
      texto,
      escopo: z.enum(["equipe", "pessoal"]),
    })
    .strict(),
  z.object({ empresa, acao: z.literal("alterar"), id, atalho, texto }).strict(),
  z.object({ empresa, acao: z.literal("apagar"), id }).strict(),
  z.object({ empresa, acao: z.literal("usar"), id }).strict(),
]);

function semAcento(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Atalho que começa com o termo vem antes do que só contém; depois, o que aparece no texto. */
export function filtrarRespostas(itens: RespostaRapida[], termo: string) {
  const busca = semAcento(termo.trim());
  if (!busca) return itens;
  const nota = (r: RespostaRapida) => {
    const atalhoNormal = semAcento(r.atalho);
    if (atalhoNormal.startsWith(busca)) return 0;
    if (atalhoNormal.includes(busca)) return 1;
    return semAcento(r.texto).includes(busca) ? 2 : 3;
  };
  return itens
    .map((r) => ({ r, n: nota(r) }))
    .filter((x) => x.n < 3)
    .sort((a, b) => a.n - b.n)
    .map((x) => x.r);
}

export type TokenBarra = { inicio: number; fim: number; termo: string };

/** A palavra iniciada por "/" onde o cursor está. Barra no meio de um link ou de uma data não conta. */
export function tokenBarra(texto: string, cursor: number): TokenBarra | null {
  const achado = /(?:^|\s)\/([^\s/]*)$/.exec(texto.slice(0, cursor));
  if (!achado) return null;
  const seguinte = texto[cursor];
  if (seguinte && !/\s/.test(seguinte)) return null;
  const termo = achado[1] ?? "";
  return { inicio: cursor - termo.length - 1, fim: cursor, termo };
}

export function trocarToken(texto: string, token: TokenBarra, valor: string) {
  return {
    texto: texto.slice(0, token.inicio) + valor + texto.slice(token.fim),
    cursor: token.inicio + valor.length,
  };
}

export const VARIAVEIS_RESPOSTA = [
  { chave: "saudacao", ajuda: "Bom dia, Boa tarde ou Boa noite" },
  { chave: "nome", ajuda: "Primeiro nome do contato" },
  { chave: "unidade", ajuda: "Unidade preferida do contato" },
] as const;
const PADRAO_VARIAVEL = /\{(saudacao|nome|unidade)\}/g;

export function saudacaoDoDia(agora = Date.now()) {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(agora),
  );
  if (hora < 12) return "Bom dia";
  return hora < 18 ? "Boa tarde" : "Boa noite";
}

/** Primeiro nome de verdade. Telefone, identificador e contato anonimizado não viram saudação. */
export function primeiroNome(contato: {
  nome_exibicao?: string | null | undefined;
  nome?: string | null | undefined;
  nome_origem?: string | null | undefined;
}) {
  if (["telefone", "identificador", "anonimizado"].includes(contato.nome_origem ?? "")) return null;
  const primeiro = (contato.nome_exibicao ?? contato.nome ?? "").trim().split(/\s+/)[0] ?? "";
  return /\p{L}/u.test(primeiro) ? primeiro : null;
}

/** O que a conversa não sabe fica como está, para a pessoa completar antes de enviar. */
export function aplicarVariaveis(
  texto: string,
  dados: { nome?: string | null; unidade?: string | null; agora?: number },
) {
  return texto.replace(PADRAO_VARIAVEL, (marca, chave: string) => {
    if (chave === "saudacao") return saudacaoDoDia(dados.agora);
    const valor = chave === "nome" ? dados.nome : dados.unidade;
    return valor?.trim() ? valor.trim() : marca;
  });
}

export function variaveisPendentes(texto: string) {
  return [...new Set(texto.match(PADRAO_VARIAVEL) ?? [])];
}
