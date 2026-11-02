import { describe, expect, test } from "bun:test";
import { AcessoNegado, autorizar } from "./modulo.server";
import {
  copiaSemIds,
  deServidor,
  grupoDoModelo,
  lerExtra,
  MAX_GRUPOS,
  mover,
  opcaoNova,
  paraEnvio,
  problemaNasOpcoes,
  regraEmPalavras,
  type GrupoEditor,
} from "./opcoes-item";

const servidor = [
  {
    id: 7,
    nome: "Tamanho",
    minimo: 1,
    maximo: 1,
    repetir: false,
    ativo: true,
    opcoes: [{ id: 70, nome: "Grande", preco_extra: 8.5, codigo: "G-1", ativo: true }],
  },
  {
    id: 8,
    nome: "Molhos",
    minimo: 0,
    maximo: 3,
    repetir: true,
    ativo: false,
    opcoes: [{ id: 80, nome: "Tarê", preco_extra: 0, codigo: null, ativo: false }],
  },
];

test("ida e volta preserva ids, código, regras e situação", () => {
  const editor = deServidor(servidor);
  expect(editor[0]!.opcoes[0]!.preco).toBe("8,50");
  expect(editor[1]!.opcoes[0]!.preco).toBe("");
  expect(paraEnvio(editor)).toEqual([
    {
      id: 7,
      nome: "Tamanho",
      minimo: 1,
      maximo: 1,
      repetir: false,
      ativo: true,
      opcoes: [{ id: 70, nome: "Grande", preco_extra: 8.5, codigo: "G-1", ativo: true }],
    },
    {
      id: 8,
      nome: "Molhos",
      minimo: 0,
      maximo: 3,
      repetir: true,
      ativo: false,
      opcoes: [{ id: 80, nome: "Tarê", preco_extra: 0, ativo: false }],
    },
  ]);
});

test("modelos prontos: tudo que é pago ou opcional sai certo para o gateway", () => {
  const [tamanho] = paraEnvio([grupoDoModelo("tamanho")]);
  expect([tamanho!.nome, tamanho!.minimo, tamanho!.maximo]).toEqual(["Tamanho", 1, 1]);
  expect(tamanho!.opcoes.map((o) => o.nome)).toEqual(["Pequeno", "Médio", "Grande"]);
  const [adicionais] = paraEnvio([grupoDoModelo("adicionais")]);
  expect([adicionais!.minimo, adicionais!.maximo, adicionais!.repetir]).toEqual([0, 5, true]);
  expect(grupoDoModelo("pessoas").opcoes.map((o) => o.nome)).toContain("6 pessoas");
  expect(paraEnvio([{ ...grupoDoModelo("adicionais"), multipla: false }])[0]).toMatchObject({
    maximo: 1,
    repetir: false,
  });
});

test("copiar de outro item nunca leva os ids da origem", () => {
  const copia = copiaSemIds(deServidor(servidor));
  const enviado = paraEnvio(copia);
  expect(enviado.every((g) => !("id" in g) && g.opcoes.every((o) => !("id" in o)))).toBe(true);
  expect(enviado[0]!.opcoes[0]!.codigo).toBe("G-1");
});

describe("preço extra", () => {
  test("aceita vírgula, ponto e vazio", () => {
    expect(lerExtra("4,50")).toBe(4.5);
    expect(lerExtra("4.5")).toBe(4.5);
    expect(lerExtra("")).toBe(0);
    expect(lerExtra(" 10 ")).toBe(10);
  });
  test("recusa negativo, letras, centavos demais e acima do teto", () => {
    for (const ruim of ["-1", "abc", "1,234", "10000", "1,2,3"]) expect(lerExtra(ruim)).toBeNull();
  });
});

describe("problemas", () => {
  const ok = (): GrupoEditor => ({ ...grupoDoModelo("tamanho") });
  test("conjunto válido e vazio passam: opções são opcionais", () => {
    expect(problemaNasOpcoes([ok()])).toBeNull();
    expect(problemaNasOpcoes([])).toBeNull();
  });
  test("aponta o que o gateway recusaria", () => {
    expect(problemaNasOpcoes([{ ...ok(), nome: " " }])).toContain("nome ao grupo");
    expect(problemaNasOpcoes([{ ...ok(), opcoes: [] }])).toContain("ao menos uma");
    expect(problemaNasOpcoes([{ ...ok(), opcoes: [opcaoNova("")] }])).toContain("cada opção");
    expect(problemaNasOpcoes([{ ...ok(), opcoes: [opcaoNova("A", "x")] }])).toContain("inválido");
    expect(problemaNasOpcoes([{ ...ok(), multipla: true, maximo: 21 }])).toContain("de 2 a 20");
    expect(problemaNasOpcoes(Array.from({ length: MAX_GRUPOS + 1 }, ok))).toContain("Até 10");
  });
  test("obrigatório sem opção ativa travaria o produto", () => {
    const g = ok();
    const inativas = g.opcoes.map((o) => ({ ...o, ativo: false }));
    expect(problemaNasOpcoes([{ ...g, opcoes: inativas }])).toContain("sem opção ativa");
    expect(problemaNasOpcoes([{ ...g, opcoes: inativas, ativo: false }])).toBeNull();
  });
});

test("regra em palavras e reordenação", () => {
  expect(regraEmPalavras(grupoDoModelo("tamanho"))).toBe("Obrigatório: escolhe uma opção");
  expect(regraEmPalavras(grupoDoModelo("adicionais"))).toBe("Opcional: pode escolher até 5 opções");
  expect(mover(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  expect(mover(["a", "b"], 0, -1)).toEqual(["a", "b"]);
});

test("só gestor grava opções; quem atende pode ler", () => {
  const partes = ["catalogo", "itens", "7", "opcoes"];
  expect(() => autorizar("funcionario", "GET", partes, undefined)).not.toThrow();
  expect(() => autorizar("supervisor", "PUT", partes, { grupos: [] })).toThrow(AcessoNegado);
  expect(() => autorizar("gestor", "PUT", partes, { grupos: [] })).not.toThrow();
  expect(() => autorizar("gestor", "PUT", partes, { grupos: [], extra: 1 })).toThrow();
});
