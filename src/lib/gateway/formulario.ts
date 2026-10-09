/**
 * Formulários do agente: valores como texto na tela, convertidos só na hora
 * de enviar. Vazio significa "usar padrão" (null) nos campos herdáveis.
 */

export type Formulario = Record<string, string>;

const NUMERICOS = new Set([
  "debounce_s",
  "max_wait_s",
  "pause_minutes",
  "slow_notice_s",
  "timeout_s",
]);

export function paraTexto(valor: unknown) {
  if (valor === null || valor === undefined) return "";
  if (Array.isArray(valor)) return valor.join("\n");
  return String(valor);
}

export function paraValor(campo: string, texto: string): unknown {
  const t = texto.trim();
  if (t === "") return null;
  if (NUMERICOS.has(campo)) return Number(t);
  if (campo === "modo_piloto") return t === "true";
  if (campo === "contatos_permitidos") {
    return t
      .split(/[\s,;]+/)
      .map((c) => c.replace(/\D/g, ""))
      .filter(Boolean);
  }
  if (campo === "alerta_telefone") return t.replace(/\D/g, "");
  return texto;
}

export function valoresIniciais(campos: string[], origem: Record<string, unknown>): Formulario {
  return Object.fromEntries(campos.map((c) => [c, paraTexto(origem[c])]));
}

/** Só os campos alterados, para não enviar o que o papel não pode mudar. */
export function diferencas(campos: string[], form: Formulario, original: Record<string, unknown>) {
  const dados: Record<string, unknown> = {};
  for (const campo of campos) {
    const texto = form[campo] ?? "";
    if (texto !== paraTexto(original[campo])) dados[campo] = paraValor(campo, texto);
  }
  return dados;
}

/** Sugere o identificador do gateway a partir do nome (3 a 40: a-z, 0-9, _). */
export function paraIdentificador(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export function numeroOuNulo(valor: string) {
  const texto = valor.trim();
  return texto === "" ? null : Number(texto);
}
