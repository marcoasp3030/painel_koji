/** Opções do produto (tamanho, adicionais, molhos, para quantas pessoas): regras do editor do painel. Tudo é opcional. */
export const MAX_GRUPOS = 10;
export const MAX_OPCOES = 30;
export const MAX_ESCOLHAS = 20;
export const MAX_NOME = 60;
const MAX_EXTRA = 9999.99;

export type OpcaoServidor = {
  id: number;
  nome: string;
  preco_extra: number;
  codigo: string | null;
  ativo: boolean;
};
export type GrupoServidor = {
  id: number;
  nome: string;
  minimo: number;
  maximo: number;
  repetir: boolean;
  ativo: boolean;
  opcoes: OpcaoServidor[];
};
export type ConjuntoOpcoes = { atualizado_em: string | null; grupos: GrupoServidor[] };

export type OpcaoEditor = {
  chave: number;
  id?: number;
  nome: string;
  preco: string;
  codigo: string | null;
  ativo: boolean;
};
export type GrupoEditor = {
  chave: number;
  id?: number;
  nome: string;
  obrigatorio: boolean;
  multipla: boolean;
  maximo: number;
  repetir: boolean;
  ativo: boolean;
  opcoes: OpcaoEditor[];
};

let proxima = 1;
const chave = () => (proxima += 1);

const precoTexto = (v: number) => (v ? v.toFixed(2).replace(".", ",") : "");

export function deServidor(grupos: readonly GrupoServidor[]): GrupoEditor[] {
  return grupos.map((g) => ({
    chave: chave(),
    id: g.id,
    nome: g.nome,
    obrigatorio: g.minimo >= 1,
    multipla: g.maximo > 1,
    maximo: g.maximo,
    repetir: g.repetir,
    ativo: g.ativo,
    opcoes: g.opcoes.map((o) => ({
      chave: chave(),
      id: o.id,
      nome: o.nome,
      preco: precoTexto(o.preco_extra),
      codigo: o.codigo,
      ativo: o.ativo,
    })),
  }));
}

export function opcaoNova(nome = "", preco = ""): OpcaoEditor {
  return { chave: chave(), nome, preco, codigo: null, ativo: true };
}

export const MODELOS = [
  {
    id: "tamanho",
    rotulo: "Tamanho",
    ajuda: "Cliente escolhe um. Use o preço do menor no produto e o acréscimo em cada opção.",
    grupo: { nome: "Tamanho", obrigatorio: true, multipla: false, maximo: 1, repetir: false },
    opcoes: ["Pequeno", "Médio", "Grande"],
  },
  {
    id: "adicionais",
    rotulo: "Adicionais",
    ajuda: "Opcional, com preço extra.",
    grupo: { nome: "Adicionais", obrigatorio: false, multipla: true, maximo: 5, repetir: true },
    opcoes: [""],
  },
  {
    id: "molhos",
    rotulo: "Molhos",
    ajuda: "Opcional, sem preço ou com preço extra.",
    grupo: { nome: "Molhos", obrigatorio: false, multipla: true, maximo: 3, repetir: false },
    opcoes: [""],
  },
  {
    id: "pessoas",
    rotulo: "Serve quantas pessoas",
    ajuda: "Cliente escolhe uma quantidade.",
    grupo: {
      nome: "Serve quantas pessoas",
      obrigatorio: true,
      multipla: false,
      maximo: 1,
      repetir: false,
    },
    opcoes: ["2 pessoas", "4 pessoas", "6 pessoas"],
  },
  {
    id: "branco",
    rotulo: "Em branco",
    ajuda: "Monte como preferir.",
    grupo: { nome: "", obrigatorio: false, multipla: false, maximo: 1, repetir: false },
    opcoes: [""],
  },
] as const;

export function grupoDoModelo(id: (typeof MODELOS)[number]["id"]): GrupoEditor {
  const m = MODELOS.find((x) => x.id === id)!;
  return {
    chave: chave(),
    ...m.grupo,
    ativo: true,
    opcoes: m.opcoes.map((nome) => opcaoNova(nome)),
  };
}

/** Grupos de outro item viram grupos novos: os ids são do item de origem. */
export function copiaSemIds(grupos: readonly GrupoEditor[]): GrupoEditor[] {
  return grupos.map(({ id: _g, ...g }) => ({
    ...g,
    chave: chave(),
    opcoes: g.opcoes.map(({ id: _o, ...o }) => ({ ...o, chave: chave() })),
  }));
}

/** "4,50", "4.5" e "" (sem acréscimo). null quando não é um valor aceito. */
export function lerExtra(texto: string) {
  const t = texto.trim().replace(",", ".");
  if (!t) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const v = Number(t);
  return v <= MAX_EXTRA ? v : null;
}

/** Limites do gateway, em palavras, para a pessoa corrigir antes de salvar. */
export function problemaNasOpcoes(grupos: readonly GrupoEditor[]) {
  if (grupos.length > MAX_GRUPOS) return `Até ${MAX_GRUPOS} grupos por produto.`;
  for (const g of grupos) {
    const nome = g.nome.trim() || "Grupo sem nome";
    if (!g.nome.trim()) return "Dê um nome ao grupo.";
    if (g.nome.trim().length > MAX_NOME) return `${nome}: nome com até ${MAX_NOME} caracteres.`;
    if (!g.opcoes.length) return `${nome}: inclua ao menos uma opção.`;
    if (g.opcoes.length > MAX_OPCOES) return `${nome}: até ${MAX_OPCOES} opções.`;
    if (g.opcoes.some((o) => !o.nome.trim())) return `${nome}: dê um nome a cada opção.`;
    if (g.opcoes.some((o) => o.nome.trim().length > MAX_NOME))
      return `${nome}: opção com até ${MAX_NOME} caracteres.`;
    if (g.opcoes.some((o) => lerExtra(o.preco) === null))
      return `${nome}: preço extra inválido. Use, por exemplo, 4,50.`;
    if (g.multipla && (g.maximo < 2 || g.maximo > MAX_ESCOLHAS))
      return `${nome}: o máximo de escolhas vai de 2 a ${MAX_ESCOLHAS}.`;
    // Grupo obrigatório sem opção ativa travaria o produto para o cliente.
    if (g.ativo && g.obrigatorio && !g.opcoes.some((o) => o.ativo))
      return `${nome}: é obrigatório e está sem opção ativa.`;
  }
  return null;
}

export function paraEnvio(grupos: readonly GrupoEditor[]) {
  return grupos.map((g) => ({
    ...(g.id ? { id: g.id } : {}),
    nome: g.nome.trim(),
    minimo: g.obrigatorio ? 1 : 0,
    maximo: g.multipla ? g.maximo : 1,
    repetir: g.multipla && g.repetir,
    ativo: g.ativo,
    opcoes: g.opcoes.map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      nome: o.nome.trim(),
      preco_extra: lerExtra(o.preco) ?? 0,
      ...(o.codigo ? { codigo: o.codigo } : {}),
      ativo: o.ativo,
    })),
  }));
}

/** Como o cliente vai ver a regra do grupo. */
export function regraEmPalavras(g: GrupoEditor) {
  const quantas = g.multipla ? `até ${g.maximo} opções` : "uma opção";
  return g.obrigatorio ? `Obrigatório: escolhe ${quantas}` : `Opcional: pode escolher ${quantas}`;
}

export function mover<T>(lista: readonly T[], indice: number, delta: number) {
  const alvo = indice + delta;
  if (alvo < 0 || alvo >= lista.length) return [...lista];
  const copia = [...lista];
  [copia[indice], copia[alvo]] = [copia[alvo]!, copia[indice]!];
  return copia;
}
