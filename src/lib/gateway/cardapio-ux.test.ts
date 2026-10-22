import { test, expect } from "bun:test";
import {
  horaDigitada,
  agruparCardapio,
  aplicarLote,
  buscaCardapio,
  disponivelAgora,
  filtrarCardapio,
  resumoRascunho,
  temRestricao,
} from "./cardapio-ux";
import { rascunhoDe, type ItemCardapio } from "./cardapio";
const item: ItemCardapio = {
  item_id: 1,
  nome: "Salmão",
  descricao: "Com legumes",
  codigo: "X1",
  categoria: "Executivos",
  unidade: "jardins",
  preco: 40,
  ativo: true,
  tipo: "item",
  disponibilidade: null,
};
test("Cardápio UX busca global, sem acento, filtros e URL não aceitam valores arbitrários", () => {
  const itens = [
    item,
    { ...item, item_id: 2, categoria: "Entradas", nome: "Tempurá", preco: null },
    { ...item, item_id: 3, unidade: "outra" },
  ];
  expect(
    filtrarCardapio(itens, buscaCardapio({ unidade: "jardins", busca: "salmao" })),
  ).toHaveLength(1);
  expect(
    filtrarCardapio(itens, buscaCardapio({ unidade: "jardins", filtro: "sem_preco" })).map(
      (i) => i.item_id,
    ),
  ).toEqual([2]);
  expect(filtrarCardapio(itens, buscaCardapio({ busca: "legumes" }))).toHaveLength(3);
  expect(buscaCardapio({ unidade: 123, filtro: "forjado", busca: [] })).toEqual({
    unidade: "",
    filtro: "todos",
    busca: "",
  });
});
test("Cardápio UX categorias seguem primeiro ID e mantêm todos os itens, inclusive sem preço", () => {
  expect(
    agruparCardapio([
      { ...item, item_id: 9, categoria: "A" },
      { ...item, item_id: 2, categoria: "Z" },
      { ...item, item_id: 3, categoria: "A", preco: null },
    ]).map((g) => [g.nome, g.itens.length]),
  ).toEqual([
    ["Z", 1],
    ["A", 2],
  ]);
});
test("CAT2 disponibilidade vem do gateway; sem o campo é desconhecida, nunca inferida", () => {
  const restrito = {
    ...item,
    disponibilidade: {
      dias_semana: [] as [],
      exceto_feriado: true,
      horario: [] as [],
      resumo: "exceto feriados",
    },
  };
  expect(temRestricao(restrito)).toBe(true);
  expect(disponivelAgora(restrito)).toBeNull();
  expect(disponivelAgora(item)).toBeNull();
  const fora = { ...restrito, disponivel_agora: false, indisponivel_motivo: "feriado" };
  const livre = { ...item, item_id: 2, disponivel_agora: true, indisponivel_motivo: null };
  expect(disponivelAgora(fora)).toBe(false);
  expect(filtrarCardapio([restrito], buscaCardapio({ filtro: "indisponiveis" }))).toHaveLength(0);
  expect(filtrarCardapio([fora, livre], buscaCardapio({ filtro: "indisponiveis" }))).toEqual([
    fora,
  ]);
  expect(filtrarCardapio([fora, livre], buscaCardapio({ filtro: "disponiveis" }))).toEqual([livre]);
});
test("Cardápio UX prévia em português e faixa atravessando meia-noite", () => {
  expect(
    resumoRascunho({
      sempre: false,
      dias: ["seg", "ter", "qua", "qui", "sex"],
      excetoFeriado: true,
      faixas: [["12:00", "15:00"]],
    }),
  ).toBe("segunda a sexta, 12h–15h, exceto feriados");
  expect(
    resumoRascunho({
      sempre: false,
      dias: ["sab", "dom"],
      excetoFeriado: false,
      faixas: [["22:30", "02:00"]],
    }),
  ).toContain("22h30–2h do dia seguinte");
});
test("Cardápio UX lote deduplica, mantém progresso e não repete falha incerta", async () => {
  const chamadas: number[] = [];
  const progresso: number[] = [];
  const r = await aplicarLote(
    [item, item, { ...item, item_id: 2 }, { ...item, item_id: 3 }],
    rascunhoDe(null),
    async (i, d) => {
      chamadas.push(i.item_id);
      expect(d).toBeNull();
      if (i.item_id === 2) throw new Error("rede");
      return { ok: true, item: i };
    },
    (r) => progresso.push(r.length),
  );
  expect(chamadas).toEqual([1, 2, 3]);
  expect(progresso).toEqual([1, 2, 3]);
  expect(r.map((x) => x.ok)).toEqual([true, false, true]);
  expect(r[1]?.mensagem).toContain("confirmar");
});

test("Horário no teclado numérico vira HH:MM sem AM/PM", () => {
  expect(horaDigitada("1230")).toBe("12:30");
  expect(horaDigitada("09:45")).toBe("09:45");
  expect(horaDigitada("9")).toBe("9");
});

test("Categorias mantêm a ordem do cardápio quando a busca oculta o primeiro item", () => {
  const a = { ...item, item_id: 1, categoria: "A" };
  const b = { ...item, item_id: 2, categoria: "B" };
  const c = { ...item, item_id: 3, categoria: "A" };
  expect(agruparCardapio([b, c], [a, b, c]).map((g) => g.nome)).toEqual(["A", "B"]);
});
