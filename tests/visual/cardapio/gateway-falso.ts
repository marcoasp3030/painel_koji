/** Gateway em memória para os prints: dados fictícios, nenhuma chamada de rede.
 * "Agora" fixo: terça-feira, 13/10/2026, 20:36 no horário da unidade. */
import { DIAS } from "@/lib/gateway/gestao";
import { precoTexto, rascunhoDe, type ItemCardapio } from "@/lib/gateway/cardapio";
import { resumoRascunho, type SalvarItem } from "@/lib/gateway/cardapio-ux";
import type { AlteracaoItem, CamposItem, ServicosCat2 } from "@/lib/gateway/cardapio-cat2";

export const REFERENCIA = "2026-10-13T20:36-03:00";
const DIA_REF = "ter";
const HORA_REF = "20:36";

export const unidades = [
  { codigo: "jardins", nome: "Jardins", fuso: "America/Sao_Paulo" },
  { codigo: "pinheiros", nome: "Pinheiros", fuso: "America/Sao_Paulo" },
];
type Regra = CamposItem["disponibilidade"];
const executivo: Regra = {
  dias_semana: ["seg", "ter", "qua", "qui", "sex"],
  exceto_feriado: true,
  horario: [["11:30", "15:00"]],
};
const base: [string, string, string, number | null, Regra?, boolean?][] = [
  [
    "Almoço executivo",
    "Executivo de salmão",
    "Salmão grelhado, arroz japonês, legumes e missoshiru.",
    69.9,
    executivo,
  ],
  ["Almoço executivo", "Executivo de frango", "Frango ao molho teriyaki e gohan.", 49.9, executivo],
  ["Petiscos", "Edamame", "Vagens de soja no vapor com flor de sal.", 34],
  ["Entradas", "Guioza de porco", "Seis unidades grelhadas, com molho ponzu.", 32],
  ["Entradas", "Tempurá de legumes", "Legumes da estação em massa leve e crocante.", null],
  ["Entradas", "Sunomono", "Pepino japonês, wakame e gergelim.", 19, undefined, false],
  ["Sushis e sashimis", "Combinado da casa", "Seleção do chef com 24 peças.", 129],
  ["Sushis e sashimis", "Sashimi de salmão", "Dez fatias de salmão fresco.", 62],
  [
    "Sobremesas",
    "Mochi de matchá",
    "Bolinho de arroz com sorvete de chá verde.",
    22,
    { dias_semana: ["sex", "sab", "dom"], exceto_feriado: false, horario: [] },
  ],
  ["Bebidas", "Chá verde gelado", "Chá da casa, sem açúcar.", 12],
  [
    "Bebidas",
    "Saquê quente",
    "Dose de 150 ml.",
    28,
    { dias_semana: [], exceto_feriado: false, horario: [["18:00", "23:30"]] },
  ],
];

function dentro(faixas: [string, string][]) {
  if (!faixas.length) return true;
  return faixas.some(([a, b]) =>
    a <= b ? HORA_REF >= a && HORA_REF < b : HORA_REF >= a || HORA_REF < b,
  );
}
function avaliarRegra(r: Regra) {
  if (!r) return { disponivel_agora: true, indisponivel_motivo: null };
  const dias = r.dias_semana.length ? r.dias_semana : [...DIAS];
  if (!dias.includes(DIA_REF))
    return { disponivel_agora: false, indisponivel_motivo: "dia_da_semana" };
  if (!dentro(r.horario)) return { disponivel_agora: false, indisponivel_motivo: "horario" };
  return { disponivel_agora: true, indisponivel_motivo: null };
}
const resumo = (r: Regra) => (r ? resumoRascunho(rascunhoDe({ ...r, resumo: null })) : null);
function avaliar(i: ItemCardapio): ItemCardapio {
  const regra = i.disponibilidade ? { ...i.disponibilidade, resumo: undefined } : (null as Regra);
  const r = !i.ativo
    ? { disponivel_agora: false, indisponivel_motivo: "item_inativo" }
    : i.preco === null
      ? { disponivel_agora: false, indisponivel_motivo: "sem_preco" }
      : avaliarRegra(regra);
  return { ...i, ...r, data_referencia: REFERENCIA };
}

let carimbo = 1;
const novoCarimbo = () =>
  `2026-10-13T23:${String(10 + carimbo++).padStart(2, "0")}:05.48213${carimbo}Z`;

export const iniciais: ItemCardapio[] = unidades.flatMap((u, n) =>
  base.map(([categoria, nome, descricao, preco, regra, ativo]) =>
    avaliar({
      item_id: n * 100 + base.findIndex((b) => b[1] === nome) + 1,
      unidade: u.codigo,
      codigo: `${u.codigo.slice(0, 3).toUpperCase()}-${String(base.findIndex((b) => b[1] === nome) + 1).padStart(4, "0")}`,
      categoria,
      nome,
      descricao,
      preco:
        n === 1 && !["Executivo de salmão", "Edamame", "Chá verde gelado"].includes(nome)
          ? null
          : preco,
      tipo: "item",
      ativo: ativo ?? true,
      atualizado_em: "2026-10-13T12:00:00.000000Z",
      disponibilidade: regra ? { ...regra, resumo: resumo(regra) } : null,
    }),
  ),
);

const historicos = new Map<number, AlteracaoItem[]>([
  [
    1,
    [
      {
        id: 31,
        actor: "marina@restaurantejardim.com.br",
        acao: "alterado",
        criado_em: "2026-10-12T21:18:44.120Z",
        antes: { preco: 64.9 },
        depois: { preco: 69.9 },
      },
      {
        id: 18,
        actor: "carlos@restaurantejardim.com.br",
        acao: "alterado",
        criado_em: "2026-10-09T14:02:10.000Z",
        antes: { descricao: "Salmão grelhado e arroz.", disponibilidade: null },
        depois: {
          descricao: "Salmão grelhado, arroz japonês, legumes e missoshiru.",
          disponibilidade: { ...executivo, resumo: resumo(executivo) },
        },
      },
    ],
  ],
]);

/** Serviços do CAT2 sobre a lista em memória da prévia. */
export function criarServicos(
  ler: () => ItemCardapio[],
  gravar: (i: ItemCardapio) => void,
  ator: string,
): { servicos: ServicosCat2; salvar: SalvarItem } {
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let conflitoGuioza = true;
  const aplicar = (atual: ItemCardapio, campos: CamposItem) => {
    const antes: Record<string, unknown> = {};
    const depois: Record<string, unknown> = {};
    const novo = { ...atual } as ItemCardapio & Record<string, unknown>;
    for (const [k, v] of Object.entries(campos)) {
      const valor =
        k === "disponibilidade" && v ? { ...(v as object), resumo: resumo(v as Regra) } : v;
      antes[k] = (atual as unknown as Record<string, unknown>)[k];
      depois[k] = valor;
      novo[k] = valor;
    }
    const salvo = avaliar({ ...novo, atualizado_em: novoCarimbo() });
    gravar(salvo);
    historicos.set(atual.item_id, [
      {
        id: 100 + carimbo,
        actor: ator,
        acao: "alterado",
        criado_em: new Date("2026-10-13T23:36:00Z").toISOString(),
        antes,
        depois,
      },
      ...(historicos.get(atual.item_id) ?? []),
    ]);
    return salvo;
  };
  const servicos: ServicosCat2 = {
    obter: async (id) => {
      await espera(150);
      return ler().find((i) => i.item_id === id)!;
    },
    categorias: async (unidade) => {
      const nomes = new Map<string, number>();
      for (const i of ler().filter((i) => i.unidade === unidade))
        nomes.set(i.categoria ?? "", (nomes.get(i.categoria ?? "") ?? 0) + 1);
      return {
        categorias: [...nomes].map(([categoria, qtd_itens], n) => ({
          categoria,
          ordem: n + 1,
          qtd_itens,
        })),
      };
    },
    previa: async (_unidade, regra) => {
      await espera(250);
      return {
        resumo: resumo(regra ?? null),
        ...avaliarRegra(regra ?? null),
        data_referencia: REFERENCIA,
      };
    },
    historico: async (id) => {
      await espera(200);
      return { itens: historicos.get(id) ?? [], proximo_cursor: null };
    },
    atualizarLocal: gravar,
    editar: async (item, campos) => {
      await espera(500);
      const atual = ler().find((i) => i.item_id === item.item_id)!;
      if (item.nome === "Guioza de porco" && conflitoGuioza) {
        conflitoGuioza = false;
        const outro = aplicar(atual, {
          preco: 34,
          descricao: "Oito unidades grelhadas, com molho ponzu.",
        });
        return {
          ok: false,
          campo: "atualizado_em",
          mensagem:
            "O item foi alterado por outra pessoa. Confira os dados atuais e salve de novo.",
          atual: outro,
        };
      }
      if (atual.atualizado_em !== item.atualizado_em)
        return {
          ok: false,
          campo: "atualizado_em",
          mensagem: "O item foi alterado por outra pessoa.",
          atual,
        };
      if (typeof campos.preco === "number" && campos.preco > 99999.99)
        return { ok: false, campo: "preco", mensagem: `Preço acima de ${precoTexto(99999.99)}.` };
      return { ok: true, item: aplicar(atual, campos) };
    },
  };
  const salvar: SalvarItem = async (i, d) => {
    const r = await servicos.editar(i, { disponibilidade: d });
    return r;
  };
  return { servicos, salvar };
}
