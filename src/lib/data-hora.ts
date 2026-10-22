/**
 * Data e hora em pt-BR, sem depender do idioma do navegador.
 * O input nativo usa o idioma do Chromium, não o lang da página.
 */

/** Máscara enquanto a pessoa digita: 21102026 vira 21/10/2026. */
export function mascaraData(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/** dd/mm/aaaa válido vira AAAA-MM-DD. Incompleto ou impossível vira vazio. */
export function dataBrParaIso(texto: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return "";
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1900 || ano > 2100) return "";
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return "";
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** AAAA-MM-DD vira dd/mm/aaaa. Outro formato fica vazio. */
export function isoParaDataBr(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
