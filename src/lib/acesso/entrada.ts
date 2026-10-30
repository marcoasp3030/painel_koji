/** Limite de tentativas de login/MFA (ENTRADA1). */

export const ENTRADA_FALHAS_MAX = 5;
export const ENTRADA_JANELA_MS = 15 * 60 * 1000;
export const ENTRADA_BLOQUEIO_MS = 15 * 60 * 1000;

export function chaveTentativa(email: string, ip?: string | null) {
  const e = email.trim().toLowerCase();
  const i = (ip ?? "").trim();
  return i ? `${e}|${i}` : e;
}

export function registrarFalhaEntrada(entrada: {
  falhas: number;
  falhaEm: string | null;
  agora: Date;
}): { falhas: number; bloqueadoAte: string | null; alertar: boolean } {
  const naJanela =
    entrada.falhaEm &&
    entrada.agora.getTime() - new Date(entrada.falhaEm).getTime() < ENTRADA_JANELA_MS;
  const falhas = (naJanela ? entrada.falhas : 0) + 1;
  if (falhas >= ENTRADA_FALHAS_MAX) {
    return {
      falhas,
      bloqueadoAte: new Date(entrada.agora.getTime() + ENTRADA_BLOQUEIO_MS).toISOString(),
      alertar: falhas === ENTRADA_FALHAS_MAX,
    };
  }
  return { falhas, bloqueadoAte: null, alertar: false };
}

export function minutosRestantes(bloqueadoAte: string, agora = new Date()) {
  const ms = new Date(bloqueadoAte).getTime() - agora.getTime();
  return Math.max(1, Math.ceil(ms / 60_000));
}

export function mensagemBloqueio(bloqueadoAte: string, agora = new Date()) {
  return `Muitas tentativas. Tente de novo em ${minutosRestantes(bloqueadoAte, agora)} minutos.`;
}

export const MSG_LOGIN_ERRO = "E-mail ou senha incorretos.";
export const MSG_ESQUECI =
  "Se o e-mail existir, enviamos um link.";
export const MSG_ESQUECI_SEM_SMTP =
  "Peça a redefinição ao gestor da sua empresa.";
export const MSG_CODIGO_ERRADO = "Código incorreto. Tente de novo.";
export const MSG_CODIGO_VENCIDO = "Este código não vale mais. Peça um novo.";
export const MSG_SESSAO_EXPIRADA = "Sua sessão expirou. Entre de novo para continuar.";
