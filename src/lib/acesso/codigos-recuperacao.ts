/** Códigos de recuperação da segunda etapa. O navegador só gera o texto.
 * O servidor guarda o hash. */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizarCodigo(codigo: string) {
  return codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Oito códigos no formato AB3K-9Q2M. */
export function gerarCodigosRecuperacao(quantidade = 8) {
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
