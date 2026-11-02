/** Tema do cardápio público: das três cores da empresa saem todas as demais, sempre com contraste legível. */
import type { CSSProperties } from "react";

export type AparenciaCardapio = {
  nome_exibicao: string | null;
  slogan: string | null;
  cor_primaria: string;
  cor_destaque: string;
  cor_fundo: string;
  cantos: "retos" | "suave" | "arredondado";
  titulos: "classica" | "moderna";
  logo_url: string | null;
  banner_url: string | null;
  banner_foco: number;
};

type Rgb = [number, number, number];

export const CORES_PADRAO = {
  cor_primaria: "#2e2340",
  cor_destaque: "#c9a24b",
  cor_fundo: "#f4f2ee",
};

export const PALETAS = [
  { nome: "Clássica", ...CORES_PADRAO },
  { nome: "Brasa", cor_primaria: "#b3261e", cor_destaque: "#ffb300", cor_fundo: "#fff8f3" },
  { nome: "Oceano", cor_primaria: "#0b5a7a", cor_destaque: "#ff8a4c", cor_fundo: "#f2f8fb" },
  { nome: "Horta", cor_primaria: "#1f6b45", cor_destaque: "#f2b93b", cor_fundo: "#f5f8f1" },
  { nome: "Noite", cor_primaria: "#e0a526", cor_destaque: "#f25c3c", cor_fundo: "#14131a" },
  { nome: "Sakura", cor_primaria: "#c2185b", cor_destaque: "#2b2b3a", cor_fundo: "#fff5f8" },
] as const;

const paraRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const paraHex = (rgb: Rgb) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** Mistura `peso` (0 a 1) de b em a. */
export function misturar(a: string, b: string, peso: number) {
  const x = paraRgb(a);
  const y = paraRgb(b);
  return paraHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * peso) as Rgb);
}

export function luminancia(hex: string) {
  const [r, g, b] = paraRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre duas cores, de 1 a 21. */
export function contraste(a: string, b: string) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (escuro + 0.05);
}

const CLARO = "#ffffff";
const ESCURO = "#17131d";

/** Texto legível sobre a cor. */
export const textoSobre = (cor: string) =>
  contraste(cor, CLARO) >= contraste(cor, ESCURO) ? CLARO : ESCURO;

/** A cor mais próxima da original que alcança o contraste pedido sobre o fundo. */
export function legivelSobre(cor: string, fundo: string, minimo = 4.5) {
  const alvo = textoSobre(fundo);
  for (let peso = 0; peso <= 1; peso += 0.05) {
    const tentativa = misturar(cor, alvo, peso);
    if (contraste(tentativa, fundo) >= minimo) return tentativa;
  }
  return alvo;
}

export const fundoEscuro = (fundo: string) => textoSobre(fundo) === CLARO;

export type AvisoCor = "primaria_igual_fundo" | "destaque_igual_primaria";

/** O que vale avisar a quem escolhe as cores. O texto já se ajusta; aqui é o que não dá para corrigir sozinho. */
export function avisosDasCores(c: {
  cor_primaria: string;
  cor_destaque: string;
  cor_fundo: string;
}): AvisoCor[] {
  const avisos: AvisoCor[] = [];
  if (contraste(c.cor_primaria, c.cor_fundo) < 1.5) avisos.push("primaria_igual_fundo");
  if (contraste(c.cor_destaque, c.cor_primaria) < 1.5) avisos.push("destaque_igual_primaria");
  return avisos;
}

const RAIOS: Record<AparenciaCardapio["cantos"], Record<string, string>> = {
  retos: {
    "--radius-xl": "0.25rem",
    "--radius-2xl": "0.375rem",
    "--radius-3xl": "0.5rem",
  },
  suave: {},
  arredondado: {
    "--radius-xl": "1rem",
    "--radius-2xl": "1.5rem",
    "--radius-3xl": "2rem",
  },
};

export type Tema = { estilo: CSSProperties; classe: string };

/**
 * Sobrescreve as variáveis de cor só dentro da página: o tema do projeto usa `@theme inline`, então as classes de sempre
 * passam a seguir a empresa. Vale também para os painéis, que abrem fora da árvore e precisam receber o mesmo estilo.
 */
export function temaDoCardapio(a: AparenciaCardapio | null | undefined): Tema {
  const primaria = a?.cor_primaria ?? CORES_PADRAO.cor_primaria;
  const destaque = a?.cor_destaque ?? CORES_PADRAO.cor_destaque;
  const fundo = a?.cor_fundo ?? CORES_PADRAO.cor_fundo;
  const escuro = fundoEscuro(fundo);
  const texto = textoSobre(fundo);
  const cartao = escuro ? misturar(fundo, CLARO, 0.08) : CLARO;
  const estilo = {
    "--cd-sobre": textoSobre(primaria),
    "--cd-sobre-destaque": textoSobre(destaque),
    "--cd-destaque": destaque,
    // Texto na cor da marca: acompanha a empresa sem perder a leitura sobre o cartão.
    "--cd-marca": legivelSobre(primaria, cartao),
    "--purple-900": misturar(primaria, "#000000", 0.28),
    "--purple-800": primaria,
    "--purple-700": misturar(primaria, "#000000", 0.1),
    "--purple-600": misturar(primaria, CLARO, 0.16),
    "--purple-500": misturar(primaria, cartao, 0.15),
    "--purple-400": misturar(primaria, cartao, 0.35),
    "--purple-300": misturar(primaria, cartao, 0.55),
    "--purple-200": misturar(primaria, cartao, 0.75),
    "--purple-100": misturar(primaria, cartao, 0.86),
    "--purple-50": misturar(primaria, cartao, 0.92),
    "--ink-900": texto,
    "--ink-700": misturar(texto, cartao, 0.2),
    "--ink-500": misturar(texto, cartao, 0.4),
    "--ink-300": misturar(texto, cartao, 0.68),
    "--base-50": escuro ? misturar(cartao, CLARO, 0.04) : misturar(fundo, CLARO, 0.6),
    "--base-100": fundo,
    "--base-200": misturar(fundo, texto, 0.12),
    "--card": cartao,
    "--card-foreground": texto,
    "--background": fundo,
    "--foreground": texto,
    "--border": misturar(fundo, texto, 0.12),
    "--gold-700": legivelSobre("#92670f", cartao),
    "--success": legivelSobre("#2f6b4f", cartao),
    "--success-soft": misturar("#2f6b4f", cartao, 0.86),
    "--destructive": legivelSobre("#b3261e", cartao),
    colorScheme: escuro ? "dark" : "light",
    ...RAIOS[a?.cantos ?? "suave"],
  } as CSSProperties;
  return { estilo, classe: a?.titulos === "moderna" ? "cd-titulos-modernos" : "" };
}
