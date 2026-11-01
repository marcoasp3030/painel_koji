/** Regras puras do MFA1. Sem I/O. Horários tratados como Instant (UTC/ISO). */

import type { PapelAcesso } from "./papeis";
import { contaEmergencia, decidirSegundaEtapa, type DecisaoSegundaEtapa } from "./segunda-etapa";

/** Ligada só depois do §9 da ESPEC (Marco + emergência com fator e 10 códigos). */
export function mfa1ObrigatorioLigado() {
  return process.env["MFA1_OBRIGATORIO"] === "1" || process.env["MFA1_OBRIGATORIO"] === "true";
}

export const MAX_FATORES_TOTP = 2;
export { QTD_CODIGOS_RECUPERACAO } from "./codigos-recuperacao";
export const STEP_UP_MS = 15 * 60 * 1000;
export const BLOQUEIO_MS = 15 * 60 * 1000;
export const FALHAS_PARA_BLOQUEIO = 5;
export const JANELA_FALHAS_MS = 15 * 60 * 1000;
/** Janela em que o código de recuperação vale como aal2 no painel. */
export const RECUPERACAO_SESSAO_MS = 12 * 60 * 60 * 1000;

export type NivelAal = "aal1" | "aal2" | "aal3";

export function lerAal(claims: Record<string, unknown> | null | undefined): NivelAal {
  const v = claims?.["aal"];
  if (v === "aal2" || v === "aal3" || v === "aal1") return v;
  return "aal1";
}

export function sessaoEhAal2(claims: Record<string, unknown> | null | undefined) {
  const aal = lerAal(claims);
  return aal === "aal2" || aal === "aal3";
}

/** Quem a empresa/papel obriga a ter fator (independentemente de já ter). */
export function papelExigeMfa(entrada: {
  papel: PapelAcesso | null;
  emergencia: boolean;
  mfaEmpresa: boolean;
  obrigatorioGlobal: boolean;
  /** Interruptor global do Super Admin: desliga obrigação em tudo. */
  mfaDesativado?: boolean;
}) {
  if (entrada.mfaDesativado) return false;
  if (entrada.emergencia) return true;
  if (!entrada.obrigatorioGlobal) {
    // Antes do cutover: só plataforma (e emergência) como hoje.
    return entrada.papel === "plataforma";
  }
  if (entrada.papel === "plataforma" || entrada.papel === "gestor") return true;
  if (
    (entrada.papel === "supervisor" || entrada.papel === "funcionario") &&
    entrada.mfaEmpresa
  ) {
    return true;
  }
  return false;
}

/**
 * Sessão precisa de aal2 para funções de negócio.
 * - Com fator verified: sempre (login deve ter confirmado o TOTP).
 * - Sem fator: nunca exige aal2 (é impossível elevar). A UI usa `bloqueado`
 *   para forçar o cadastro (emergência / cutover / prazo); o servidor não
 *   pode pedir aal2 sem fator — isso deixava o seletor de empresas vazio.
 */
export function exigeAal2(entrada: {
  papel: PapelAcesso | null;
  emergencia: boolean;
  mfaEmpresa: boolean;
  obrigatorioGlobal: boolean;
  fatores: number;
  bloqueado: boolean;
  mfaDesativado?: boolean;
}) {
  if (entrada.mfaDesativado) return false;
  void entrada.papel;
  void entrada.emergencia;
  void entrada.mfaEmpresa;
  void entrada.obrigatorioGlobal;
  void entrada.bloqueado;
  return entrada.fatores > 0;
}

/** Decisão de UI/bloqueio de cadastro. Com cutover ligado, sem prazo de 7 dias. */
export function decidirMfa1(entrada: {
  papel: PapelAcesso | null;
  email: string | null;
  emergenciaMarcada: boolean;
  fatores: number;
  mfaEmpresa: boolean;
  prazoAte: string | null;
  agora: Date;
  obrigatorioGlobal: boolean;
  mfaDesativado?: boolean;
}): DecisaoSegundaEtapa & { exigeAal2: boolean } {
  if (entrada.mfaDesativado) {
    return {
      obrigatorio: false,
      bloqueado: false,
      prazo_ate: null,
      gravarPrazo: null,
      exigeAal2: false,
    };
  }
  const emergencia = contaEmergencia(entrada.email, entrada.emergenciaMarcada);
  const obrigado = papelExigeMfa({
    papel: entrada.papel,
    emergencia,
    mfaEmpresa: entrada.mfaEmpresa,
    obrigatorioGlobal: entrada.obrigatorioGlobal,
    mfaDesativado: false,
  });

  if (!obrigado) {
    const aal2 = exigeAal2({
      papel: entrada.papel,
      emergencia,
      mfaEmpresa: entrada.mfaEmpresa,
      obrigatorioGlobal: entrada.obrigatorioGlobal,
      fatores: entrada.fatores,
      bloqueado: false,
      mfaDesativado: false,
    });
    return {
      obrigatorio: false,
      bloqueado: false,
      prazo_ate: null,
      gravarPrazo: null,
      exigeAal2: aal2,
    };
  }

  if (entrada.obrigatorioGlobal || emergencia) {
    const bloqueado = entrada.fatores === 0;
    return {
      obrigatorio: true,
      bloqueado,
      prazo_ate: null,
      gravarPrazo: null,
      exigeAal2: exigeAal2({
        papel: entrada.papel,
        emergencia,
        mfaEmpresa: entrada.mfaEmpresa,
        obrigatorioGlobal: entrada.obrigatorioGlobal,
        fatores: entrada.fatores,
        bloqueado,
        mfaDesativado: false,
      }),
    };
  }

  // Cutover ainda desligado: plataforma mantém os 7 dias.
  const legado = decidirSegundaEtapa({
    plataforma: true,
    emergencia: false,
    fatores: entrada.fatores,
    prazoAte: entrada.prazoAte,
    agora: entrada.agora,
  });
  return {
    ...legado,
    exigeAal2: exigeAal2({
      papel: entrada.papel,
      emergencia,
      mfaEmpresa: entrada.mfaEmpresa,
      obrigatorioGlobal: entrada.obrigatorioGlobal,
      fatores: entrada.fatores,
      bloqueado: legado.bloqueado,
      mfaDesativado: false,
    }),
  };
}

export function stepUpValido(stepUpAte: string | null | undefined, agora: Date) {
  if (!stepUpAte) return false;
  return new Date(stepUpAte).getTime() > agora.getTime();
}

export function novoStepUpAte(agora: Date) {
  return new Date(agora.getTime() + STEP_UP_MS).toISOString();
}

export function registrarFalhaMfa(entrada: {
  falhas: number;
  falhaEm: string | null;
  agora: Date;
}): { falhas: number; bloqueadoAte: string | null; alertar: boolean } {
  const naJanela =
    entrada.falhaEm &&
    agoraNaJanela(entrada.falhaEm, entrada.agora, JANELA_FALHAS_MS);
  const falhas = (naJanela ? entrada.falhas : 0) + 1;
  if (falhas >= FALHAS_PARA_BLOQUEIO) {
    return {
      falhas,
      bloqueadoAte: new Date(entrada.agora.getTime() + BLOQUEIO_MS).toISOString(),
      alertar: falhas === FALHAS_PARA_BLOQUEIO,
    };
  }
  return { falhas, bloqueadoAte: null, alertar: false };
}

function agoraNaJanela(desde: string, agora: Date, ms: number) {
  return agora.getTime() - new Date(desde).getTime() < ms;
}

export function mfaBloqueado(bloqueadoAte: string | null | undefined, agora: Date) {
  if (!bloqueadoAte) return false;
  return new Date(bloqueadoAte).getTime() > agora.getTime();
}

export const ACOES_STEP_UP = [
  "usuarios.criar",
  "usuarios.alterar",
  "usuarios.papel",
  "usuarios.reset_mfa",
  "chaves",
  "webhooks",
  "integracoes",
  "exportar",
  "comportamento.publicar",
  "empresa.mfa_obrigatorio",
] as const;

export type AcaoStepUp = (typeof ACOES_STEP_UP)[number];
