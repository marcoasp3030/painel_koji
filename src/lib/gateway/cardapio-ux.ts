import { DIAS } from "./gestao";
import {
  corpoDisponibilidade,
  type Dia,
  type ItemCardapio,
  type RascunhoDisponibilidade,
} from "./cardapio";
export const FILTROS_CARDAPIO = [
  "todos",
  "disponiveis",
  "restricao",
  "sem_preco",
  "inativos",
  "indisponiveis",
  "esgotados",
  "arquivados",
] as const;
export type FiltroCardapio = (typeof FILTROS_CARDAPIO)[number];
export type BuscaCardapio = {
  unidade: string;
  busca: string;
  filtro: FiltroCardapio;
  categoria?: string;
  prato?: string;
};
export function buscaCardapio(v: Record<string, unknown>): BuscaCardapio {
  return {
    ...(typeof v["categoria"] === "string" ? { categoria: v["categoria"] } : {}),
    ...(typeof v["prato"] === "string" ? { prato: v["prato"] } : {}),
    unidade: typeof v["unidade"] === "string" ? v["unidade"].slice(0, 40) : "",
    busca: typeof v["busca"] === "string" ? v["busca"].slice(0, 200) : "",
    filtro: FILTROS_CARDAPIO.includes(v["filtro"] as FiltroCardapio)
      ? (v["filtro"] as FiltroCardapio)
      : "todos",
  };
}
export const NOMES_DIA: Record<Dia, string> = {
  seg: "segunda",
  ter: "terça",
  qua: "quarta",
  qui: "quinta",
  sex: "sexta",
  sab: "sábado",
  dom: "domingo",
};
export function temRestricao(i: ItemCardapio) {
  const d = i.disponibilidade;
  return Boolean(
    d &&
    ((d.dias_semana.length > 0 && d.dias_semana.length < 7) ||
      d.exceto_feriado ||
      d.horario.length),
  );
}
/** Avaliação do gateway (CAT2: mesma função da Skill). Sem o campo, a situação é desconhecida:
 * nunca inferir no navegador. */
export function disponivelAgora(i: ItemCardapio): boolean | null {
  return typeof i.disponivel_agora === "boolean" ? i.disponivel_agora : null;
}
function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
export function filtrarCardapio(itens: ItemCardapio[], f: BuscaCardapio) {
  const q = normalizar(f.busca.trim());
  return itens.filter(
    (i) =>
      (!f.unidade || i.unidade === f.unidade) &&
      (!q ||
        normalizar([i.nome, i.descricao, i.categoria, i.codigo].filter(Boolean).join(" ")).includes(
          q,
        )) &&
      (f.filtro === "todos" ||
        (f.filtro === "arquivados" && i.arquivado) ||
        (f.filtro === "esgotados" && (i.esgotado_agora ?? i.indisponivel_motivo === "esgotado")) ||
        (f.filtro === "sem_preco" && i.preco === null) ||
        (f.filtro === "restricao" && temRestricao(i)) ||
        (f.filtro === "inativos" && !i.ativo) ||
        (f.filtro === "disponiveis" && disponivelAgora(i) === true) ||
        (f.filtro === "indisponiveis" && disponivelAgora(i) === false)),
  );
}
export function agruparCardapio(itens: ItemCardapio[], referencia = itens) {
  const grupos = new Map<string, ItemCardapio[]>();
  for (const i of [...itens].sort((a, b) => a.item_id - b.item_id)) {
    const nome = i.categoria || "Sem categoria";
    grupos.set(nome, [...(grupos.get(nome) ?? []), i]);
  }
  const ordem = [
    ...new Set(
      [...referencia]
        .sort((a, b) => a.item_id - b.item_id)
        .map((i) => i.categoria || "Sem categoria"),
    ),
  ];
  return [...grupos]
    .map(([nome, itens]) => ({ nome, itens }))
    .sort((a, b) => ordem.indexOf(a.nome) - ordem.indexOf(b.nome));
}
function horaResumo(s: string) {
  const [h, m] = s.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}
export function resumoRascunho(r: RascunhoDisponibilidade) {
  if (r.sempre) return "todos os dias, o dia inteiro";
  const dias = DIAS.filter((d) => r.dias.includes(d));
  const d =
    dias.length === 7
      ? "todos os dias"
      : dias.join() === "seg,ter,qua,qui,sex"
        ? "segunda a sexta"
        : dias.join() === "sab,dom"
          ? "sábado e domingo"
          : dias.map((d) => NOMES_DIA[d]).join(", ") || "nenhum dia selecionado";
  return [
    d,
    r.faixas.length
      ? r.faixas
          .map(([a, b]) => `${horaResumo(a)}–${horaResumo(b)}${b < a ? " do dia seguinte" : ""}`)
          .join(" e ")
      : "o dia inteiro",
    r.excetoFeriado ? "exceto feriados" : null,
  ]
    .filter(Boolean)
    .join(", ");
}
export type ResultadoItem =
  | { ok: true; item: ItemCardapio }
  | {
      ok: false;
      mensagem: string;
      campo?: string | undefined;
      /** 409: o item como está no gateway agora. */
      atual?: ItemCardapio | undefined;
    };
export type SalvarItem = (
  i: ItemCardapio,
  d: ReturnType<typeof corpoDisponibilidade>,
) => Promise<ResultadoItem>;
export type ResultadoLote = { item: ItemCardapio; ok: boolean; mensagem?: string };
/** Uma chamada por ID, sequencial; nunca repete automaticamente resultado incerto. */
export async function aplicarLote(
  itens: ItemCardapio[],
  r: RascunhoDisponibilidade,
  salvar: SalvarItem,
  progresso: (resultados: ResultadoLote[]) => void,
) {
  const resultados: ResultadoLote[] = [];
  for (const i of [...new Map(itens.map((i) => [i.item_id, i])).values()]) {
    try {
      const v = await salvar(i, corpoDisponibilidade(r));
      resultados.push(v.ok ? { item: i, ok: true } : { item: i, ok: false, mensagem: v.mensagem });
    } catch {
      resultados.push({
        item: i,
        ok: false,
        mensagem:
          "Não foi possível confirmar a gravação. Confira o item antes de tentar novamente.",
      });
    }
    progresso([...resultados]);
  }
  return resultados;
}

/** Teclado numérico no celular: 1230 vira 12:30, sem depender de input time/locale. */
export function horaDigitada(valor: string) {
  if (valor.includes(":")) return valor.slice(0, 5);
  const digitos = valor.replace(/\D/g, "").slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;
}
