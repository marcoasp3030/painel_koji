/**
 * Teto do corpo das funções do servidor (/_serverFn/), por onde o simulador
 * manda o arquivo em JSON (o PDF vai em base64). 15 MB decimais, o mesmo
 * valor do proxy em docker/Caddyfile.
 */
export const LIMITE_CORPO_BYTES = 15_000_000;

export const PREFIXO_FUNCAO_SERVIDOR = "/_serverFn/";

/** true quando o Content-Length da função do servidor passa de 15 MB. */
export function corpoDaFuncaoExcede(caminho: string, contentLength: string | null) {
  if (!caminho.startsWith(PREFIXO_FUNCAO_SERVIDOR)) return false;
  if (contentLength == null || contentLength === "") return false;
  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > LIMITE_CORPO_BYTES;
}
