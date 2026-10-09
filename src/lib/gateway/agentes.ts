/**
 * Conferências do painel antes de alterar um agente no gateway, para que o
 * usuário receba o motivo real e o que fazer, em vez de um 409 genérico.
 */
import { GatewayErro } from "./erros";

/** Colunas que o gateway não aceita vazias (NULL vira 409 sem detalhes). */
const OBRIGATORIOS: Record<string, string> = {
  nome: "Nome",
  status: "Situação",
  provedor: "Provedor",
  skyone_auth_tipo: "Autenticação do Skyone",
  timeout_s: "Tempo limite",
};

const CAMPOS_IA = new Set([
  "provedor",
  "agente_mode",
  "skyone_webhook_url",
  "skyone_auth_tipo",
  "skyone_auth",
  "skyone_auth_usuario",
]);

function invalido(mensagem: string, campo: string): never {
  throw new GatewayErro({ codigo: "VALIDATION_ERROR", status: 400, mensagem, detalhes: { campo } });
}

/** Troca vazio por "" onde o gateway espera texto e recusa vazio onde é obrigatório. */
export function normalizarPatchAgente(dados: Record<string, unknown>) {
  const saida = { ...dados };
  if (saida["instrucoes_agente"] === null) saida["instrucoes_agente"] = "";
  for (const [campo, rotulo] of Object.entries(OBRIGATORIOS)) {
    if (campo in saida && (saida[campo] === null || saida[campo] === "")) {
      invalido(`O campo “${rotulo}” não pode ficar vazio.`, campo);
    }
  }
  return saida;
}

export function tocaIaReal(dados: Record<string, unknown>) {
  return Object.keys(dados).some((campo) => CAMPOS_IA.has(campo));
}

export type EstadoAgente = {
  provedor: string;
  agente_mode: string | null;
  /** agente_mode efetivo (com herança), para quando o agente não define o próprio. */
  agente_mode_efetivo: string | null;
  skyone_webhook_url: string | null;
  skyone_auth_tipo: string;
  skyone_auth_configurado?: boolean | undefined;
  skyone_auth_usuario_configurado?: boolean | undefined;
};

/** Formato aceito pelo gateway para a URL do fluxo (mesmas regras, sem rede). */
export function problemaNaUrl(url: string): string | null {
  let partes: URL;
  try {
    partes = new URL(url);
  } catch {
    return "A URL do fluxo não é válida.";
  }
  if (partes.protocol !== "https:") return "A URL do fluxo precisa começar com https://.";
  if (partes.username || partes.password) return "A URL do fluxo não pode conter usuário ou senha.";
  if (partes.port && partes.port !== "443") return "A URL do fluxo só pode usar a porta 443.";
  return null;
}

/**
 * Se o resultado deixar o agente em IA real, confere o que o gateway exige:
 * Skyone como provedor, URL do fluxo e, fora de empresa de teste, credencial.
 */
export function conferirIaReal(
  atual: EstadoAgente,
  dados: Record<string, unknown>,
  empresaTeste: boolean,
) {
  const valor = <T>(campo: keyof EstadoAgente) =>
    (campo in dados ? dados[campo] : atual[campo]) as T;
  const modo =
    "agente_mode" in dados
      ? ((dados["agente_mode"] as string | null) ?? atual.agente_mode_efetivo)
      : (atual.agente_mode ?? atual.agente_mode_efetivo);

  const url = valor<string | null>("skyone_webhook_url");
  if (url) {
    const problema = problemaNaUrl(url);
    if (problema) invalido(problema, "skyone_webhook_url");
  }
  if (modo !== "live") return;

  const faltando: string[] = [];
  if (valor<string>("provedor") !== "skyone") faltando.push("escolher o Skyone como provedor");
  if (!url) faltando.push("a URL do fluxo");
  const tipo = valor<string>("skyone_auth_tipo");
  if (!empresaTeste) {
    const senha = Boolean(dados["skyone_auth"]) || Boolean(atual.skyone_auth_configurado);
    const usuario =
      Boolean(dados["skyone_auth_usuario"]) || Boolean(atual.skyone_auth_usuario_configurado);
    if (tipo === "nenhuma") faltando.push("o usuário e a senha do fluxo (autenticação Basic)");
    else if (tipo === "basic" && (!senha || !usuario)) {
      faltando.push(
        !usuario && !senha
          ? "o usuário e a senha do fluxo"
          : !usuario
            ? "o usuário do fluxo"
            : "a senha do fluxo",
      );
    } else if (tipo !== "basic" && !senha) faltando.push("a credencial do fluxo");
  }
  if (faltando.length > 0) {
    invalido(
      `Para usar a IA real, cadastre antes ${faltando.join(", ").replace(/, ([^,]*)$/, " e $1")} no Skyone.`,
      faltando.includes("a URL do fluxo") ? "skyone_webhook_url" : "skyone_auth",
    );
  }
}

/** 409 do gateway ao gravar agente: hoje significa campo obrigatório vazio no banco. */
export function explicarConflitoAgente(erro: unknown): unknown {
  if (
    erro instanceof GatewayErro &&
    erro.codigo === "CONFLICT" &&
    Object.keys(erro.detalhes).length === 0
  ) {
    return new GatewayErro({
      codigo: "CONFLICT",
      status: 409,
      mensagem:
        "O gateway recusou a gravação porque algum campo obrigatório do agente ficou vazio " +
        "(provedor, autenticação, tempo limite ou nome). Preencha esses campos e salve de novo.",
    });
  }
  return erro;
}
