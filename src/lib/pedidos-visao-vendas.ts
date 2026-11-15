/** PED-BI / 99FOOD1-b: helpers da tela Visão de vendas (filtros, variação, calor, abas, canais). */
import { FUSO_PAINEL } from "@/lib/gateway/gestao";
import type { BlocoIfoodIndicadores } from "@/lib/ifood-pedidos";
import type { BlocoFood99Indicadores } from "@/lib/food99-pedidos";

/** Cores próprias na legenda dos gráficos de canais (99Food ≠ iFood ≠ WhatsApp). */
export const COR_CANAL_VENDAS: Record<string, string> = {
  delivery: "#15803d",
  retirada: "#0369a1",
  ifood: "#ea1d2c",
  "99food": "#FF6600",
};

export const ROTULO_CANAL_VENDAS: Record<string, string> = {
  delivery: "Delivery",
  retirada: "Retirada",
  ifood: "iFood",
  "99food": "99Food",
};

export type CanalVendas = "delivery" | "retirada" | "ifood" | "99food" | string;

export type MetricasPorCanal = {
  pedidos: number;
  faturamento: number;
  ticket_medio?: number;
  participacao_pct?: number;
  quantidade?: number;
};

export type BlocoCanaisIndicadores = {
  disponiveis: CanalVendas[];
  total: { pedidos: number; faturamento: number; ticket_medio: number };
  resumo: ({ canal: CanalVendas } & MetricasPorCanal)[];
  evolucao: {
    inicio: string;
    pedidos: number;
    faturamento: number;
    por_canal: Record<string, { pedidos: number; faturamento: number }>;
  }[];
  dias_semana: unknown[];
  horas: unknown[];
  horarios: unknown[];
  pagamentos: unknown[];
  produtos: { itens: unknown[]; total: number };
};

export const MAX_DIAS_PERIODO = 366;
export const ORIGEM_SO_REAL = "real";
/** Incluir teste/piloto: real + piloto + teste (simulado continua de fora). */
export const ORIGEM_COM_TESTE = "real,piloto,teste";

export type AtalhoPeriodo = "hoje" | "7d" | "30d" | "mes" | "mes_passado" | "livre";

export const ATALHOS_PERIODO: { id: AtalhoPeriodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes_passado", rotulo: "Mês passado" },
  { id: "livre", rotulo: "Datas livres" },
];

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export type CurvaAbc = "A" | "B" | "C";

export type ResumoVendas = {
  faturamento: number;
  pedidos: number;
  ticket_medio: number;
  produtos: number;
  taxas_entrega: number;
  frete_gratis: number;
  itens_vendidos: number;
  clientes: number;
  clientes_novos: number;
  clientes_recorrentes: number;
  agendados: number;
  modalidade: {
    delivery: { pedidos: number; faturamento: number };
    retirada: { pedidos: number; faturamento: number };
  };
  recebidos: number;
  fora_da_venda: Record<string, { pedidos: number; valor: number }>;
  perda_pct: number | null;
};

export type VariacaoPct = {
  faturamento: number | null;
  pedidos: number | null;
  ticket_medio: number | null;
  itens_vendidos: number | null;
  clientes: number | null;
  clientes_novos: number | null;
};

export type ProdutoVendido = {
  item_id: number | null;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  quantidade: number;
  faturamento: number;
  pedidos: number;
  participacao_pct: number;
  curva: CurvaAbc;
  quantidade_anterior: number;
  variacao_quantidade: number | null;
};

export type ClienteRanking = {
  nome: string | null;
  telefone: string | null;
  pedidos: number;
  faturamento: number;
  ticket_medio: number;
  primeiro_pedido_em: string;
  ultimo_pedido_em: string;
  dias_sem_comprar?: number;
};

export type IndicadoresPedidos = {
  periodo: {
    de: string;
    ate: string;
    dias: number;
    agrupar: "dia" | "semana" | "mes";
    fuso: string;
    anterior: { de: string; ate: string };
  };
  filtros: { unidade: string | null; origem: string[]; sumido_dias: number };
  resumo: ResumoVendas;
  anterior: ResumoVendas;
  variacao_pct: VariacaoPct;
  evolucao: { inicio: string; pedidos: number; faturamento: number }[];
  horarios: { dia_semana: number; hora: number; pedidos: number; faturamento: number }[];
  produtos: {
    itens: ProdutoVendido[];
    total: number;
    curva: { A: number; B: number; C: number };
    categorias: { categoria: string; quantidade: number; faturamento: number }[];
    sem_venda: {
      itens: {
        item_id: number;
        codigo: string | null;
        nome: string;
        categoria: string | null;
        unidade: string | null;
      }[];
      total: number;
    };
  };
  clientes: {
    por_valor: ClienteRanking[];
    por_frequencia: ClienteRanking[];
    sumidos: { itens: ClienteRanking[]; total: number; dias: number };
  };
  pagamentos: {
    forma: string;
    rotulo: string;
    pedidos: number;
    faturamento: number;
    participacao_pct: number;
  }[];
  bairros: { bairro: string; pedidos: number; faturamento: number; taxa_media: number }[];
  operacao: {
    aceite: { mediana_min: number | null; p90_min: number | null; pedidos: number };
    preparo: { mediana_min: number | null; p90_min: number | null; pedidos: number };
    total: { mediana_min: number | null; p90_min: number | null; pedidos: number };
    motivos_perda: { status: string; motivo: string; pedidos: number }[];
  };
  unidades: {
    unidade: string;
    nome: string;
    pedidos: number;
    faturamento: number;
    ticket_medio: number;
    recebidos: number;
  }[];
  /** IFOOD1-b1: null se a empresa não tiver loja do iFood. */
  ifood: BlocoIfoodIndicadores | null;
  /** 99FOOD1-b: null se a empresa não tiver loja da 99Food. */
  "99food": BlocoFood99Indicadores | null;
  /** PED-BI2: canais juntos; `99food` em disponiveis só com loja. */
  canais?: BlocoCanaisIndicadores;
};

export function corCanalVendas(canal: string): string {
  return COR_CANAL_VENDAS[canal] ?? "#64748b";
}

export function rotuloCanalVendas(canal: string): string {
  return ROTULO_CANAL_VENDAS[canal] ?? canal;
}

/** Monta série do gráfico de evolução por canal (uma chave por canal disponível). */
export function serieEvolucaoCanais(
  evolucao: BlocoCanaisIndicadores["evolucao"],
  disponiveis: readonly string[],
  agrupar: "dia" | "semana" | "mes",
): Record<string, string | number>[] {
  return evolucao.map((p) => {
    const linha: Record<string, string | number> = {
      rotulo: rotuloDiaCurto(p.inicio, agrupar),
      inicio: p.inicio,
    };
    for (const c of disponiveis) {
      linha[c] = p.por_canal?.[c]?.faturamento ?? 0;
    }
    return linha;
  });
}

/** Dia civil AAAA-MM-DD no fuso (padrão Brasília). */
export function diaCivilNoFuso(agora = Date.now(), fuso = FUSO_PAINEL): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(agora));
}

export function somarDiasCivil(dia: string, dias: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

export function primeiroDiaDoMes(dia: string): string {
  return `${dia.slice(0, 8)}01`;
}

export function ultimoDiaDoMesAnterior(hoje: string): { de: string; ate: string } {
  const primeiroEste = primeiroDiaDoMes(hoje);
  const ate = somarDiasCivil(primeiroEste, -1);
  return { de: primeiroDiaDoMes(ate), ate };
}

export function periodoDoAtalho(
  atalho: AtalhoPeriodo,
  hoje: string,
): { de: string; ate: string } | null {
  switch (atalho) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "7d":
      return { de: somarDiasCivil(hoje, -6), ate: hoje };
    case "30d":
      return { de: somarDiasCivil(hoje, -29), ate: hoje };
    case "mes":
      return { de: primeiroDiaDoMes(hoje), ate: hoje };
    case "mes_passado":
      return ultimoDiaDoMesAnterior(hoje);
    case "livre":
      return null;
  }
}

export function diasNoPeriodo(de: string, ate: string): number {
  const a = Date.parse(`${de}T12:00:00Z`);
  const b = Date.parse(`${ate}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** null = ok; senão mensagem curta para a tela. */
export function erroPeriodo(de: string, ate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate))
    return "Informe as duas datas.";
  if (de > ate) return "A data inicial precisa ser anterior ou igual à final.";
  const dias = diasNoPeriodo(de, ate);
  if (dias < 1) return "Informe as duas datas.";
  if (dias > MAX_DIAS_PERIODO) return `O período máximo é ${MAX_DIAS_PERIODO} dias.`;
  return null;
}

export function origemDaOpcao(incluirTestePiloto: boolean): string {
  return incluirTestePiloto ? ORIGEM_COM_TESTE : ORIGEM_SO_REAL;
}

export function temVendaNoPeriodo(resumo: Pick<ResumoVendas, "pedidos">): boolean {
  return resumo.pedidos > 0;
}

export function deveMostrarAbaUnidades(unidades: { unidade: string }[]): boolean {
  return unidades.length > 1;
}

/** Seta verde/vermelha; sem seta quando null (base zero). */
export function sentidoVariacao(pct: number | null | undefined): "alta" | "baixa" | "neutra" {
  if (pct == null || pct === 0) return "neutra";
  return pct > 0 ? "alta" : "baixa";
}

export function textoVariacao(pct: number | null | undefined): string | null {
  if (pct == null) return null;
  const sinal = pct > 0 ? "+" : "";
  return `${sinal}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function ordenarProdutos<T extends { quantidade: number; faturamento: number; nome: string }>(
  itens: T[],
  por: "quantidade" | "faturamento",
): T[] {
  return [...itens].sort((a, b) => b[por] - a[por] || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Matriz 7×24 (dia_semana 0 = domingo); valor = pedidos. */
export function matrizCalorHorarios(
  horarios: { dia_semana: number; hora: number; pedidos: number }[],
): number[][] {
  const m = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const h of horarios) {
    if (h.dia_semana < 0 || h.dia_semana > 6 || h.hora < 0 || h.hora > 23) continue;
    m[h.dia_semana]![h.hora] = h.pedidos;
  }
  return m;
}

export function maximoCalor(matriz: number[][]): number {
  let m = 0;
  for (const linha of matriz) for (const n of linha) if (n > m) m = n;
  return m;
}

export function rotuloDiaCurto(inicio: string, agrupar: "dia" | "semana" | "mes"): string {
  const [y, mo, d] = inicio.slice(0, 10).split("-");
  if (!y || !mo || !d) return inicio;
  if (agrupar === "mes") return `${mo}/${y}`;
  return `${d}/${mo}`;
}

export function minutosOuTraco(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
}

export function telefoneParaBuscaConversa(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length >= 10 ? digitos : null;
}
