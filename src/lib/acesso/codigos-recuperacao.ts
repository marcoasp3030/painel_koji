/** Códigos de recuperação da segunda etapa. O navegador só gera o texto.
 * O servidor guarda o hash. MFA1: 10 códigos. */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Mantido aqui (sem process.env) porque o gerador roda no navegador. */
export const QTD_CODIGOS_RECUPERACAO = 10;

export function normalizarCodigo(codigo: string) {
  return codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Códigos no formato AB3K-9Q2M. Padrão: 10 (MFA1). */
export function gerarCodigosRecuperacao(quantidade = QTD_CODIGOS_RECUPERACAO) {
  const bytes = new Uint8Array(quantidade * 8);
  crypto.getRandomValues(bytes);
  const codigos: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    let bloco = "";
    for (let n = 0; n < 8; n++) bloco += ALFABETO[bytes[i * 8 + n]! % ALFABETO.length];
    codigos.push(`${bloco.slice(0, 4)}-${bloco.slice(4)}`);
  }
  return codigos;
}

/** Sessão com fator verificado ainda no primeiro nível: falta o código. */
export function sessaoPrecisaDoCodigo(
  nivel: {
    currentLevel?: string | null;
    nextLevel?: string | null;
  } | null,
) {
  return nivel?.nextLevel === "aal2" && nivel.currentLevel !== "aal2";
}
