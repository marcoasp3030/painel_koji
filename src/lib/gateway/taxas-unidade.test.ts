import { describe, expect, test } from "bun:test";
import {
  bairroNovo,
  camposDaUnidade,
  doServidor,
  faixaNova,
  lerValor,
  linhasParaEnvio,
  mascaraCep,
  problemaNasTaxas,
  type EditorTaxas,
} from "./taxas-unidade";

const vazio = (): EditorTaxas => ({
  modo: "fixa",
  taxaFixa: "",
  freteGratis: "",
  bairros: [],
  faixas: [],
});

test("ida e volta preserva bairro, apelidos, não atendido e faixa", () => {
  const e = doServidor({
    modo: "bairro",
    taxa_fixa: 7,
    frete_gratis_acima: 100,
    itens: [
      {
        tipo: "bairro",
        bairro: "Vila",
        apelidos: ["Vl", "V."],
        atendido: true,
        taxa: 8.5,
        ativo: true,
      },
      { tipo: "bairro", bairro: "Longe", apelidos: [], atendido: false, taxa: null, ativo: true },
      { tipo: "cep", cep_inicio: "05650000", cep_fim: "05659999", taxa: 15, ativo: false },
    ],
  });
  expect(e.bairros[0]).toMatchObject({ apelidos: "Vl, V.", taxa: "8,50" });
  expect(e.faixas[0]).toMatchObject({ inicio: "05650-000", fim: "05659-999", ativo: false });
  expect(linhasParaEnvio(e)).toEqual([
    {
      tipo: "bairro",
      bairro: "Vila",
      apelidos: ["Vl", "V."],
      atendido: true,
      taxa: 8.5,
      ativo: true,
    },
    { tipo: "bairro", bairro: "Longe", apelidos: [], atendido: false, taxa: null, ativo: true },
    { tipo: "cep", cep_inicio: "05650000", cep_fim: "05659999", taxa: 15, ativo: false },
  ]);
  expect(camposDaUnidade(e)).toEqual({
    taxa_modo: "bairro",
    taxa_entrega: 7,
    frete_gratis_acima: 100,
  });
});

test("unidade sem modo abre como valor fixo", () => {
  const e = doServidor({ modo: null, taxa_fixa: null, frete_gratis_acima: null, itens: [] });
  expect(e.modo).toBe("fixa");
  expect(camposDaUnidade(e)).toEqual({
    taxa_modo: "fixa",
    taxa_entrega: null,
    frete_gratis_acima: null,
  });
});

test("valores", () => {
  expect(lerValor("4,50")).toBe(4.5);
  expect(lerValor("")).toBe("");
  for (const ruim of ["-1", "abc", "1,234"]) expect(lerValor(ruim)).toBeNull();
  expect(mascaraCep("05650000")).toBe("05650-000");
});

describe("problemas", () => {
  test("valor fixo vazio é válido: a unidade confirma", () => {
    expect(problemaNasTaxas(vazio())).toBeNull();
  });
  test("bairro atendido precisa de taxa; não atendido, não", () => {
    const b = { ...bairroNovo(), nome: "Vila" };
    expect(problemaNasTaxas({ ...vazio(), bairros: [b] })).toContain("informe a taxa");
    expect(problemaNasTaxas({ ...vazio(), bairros: [{ ...b, atendido: false }] })).toBeNull();
  });
  test("modo por área sem linha ativa não salva", () => {
    expect(problemaNasTaxas({ ...vazio(), modo: "bairro" })).toContain("bairro ativo");
    expect(problemaNasTaxas({ ...vazio(), modo: "cep" })).toContain("faixa de CEP");
  });
  test("faixa invertida, CEP incompleto e frete zero", () => {
    const f = { ...faixaNova(), inicio: "05650-000", fim: "05640-000", taxa: "5" };
    expect(problemaNasTaxas({ ...vazio(), faixas: [f] })).toContain("antes do final");
    expect(problemaNasTaxas({ ...vazio(), faixas: [{ ...f, fim: "056" }] })).toContain("8 dígitos");
    expect(problemaNasTaxas({ ...vazio(), freteGratis: "0" })).toContain("maior que zero");
  });
});
