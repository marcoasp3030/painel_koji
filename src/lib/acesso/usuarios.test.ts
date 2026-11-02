import { describe, expect, test } from "bun:test";
import {
  filtrarUsuarios,
  podeGerirUsuario,
  situacaoUsuario,
  unidadesAcrescentadas,
  unidadesFinais,
} from "./usuarios";

describe("quem gere quem", () => {
  test("supervisor não toca em gestor nem em outro supervisor", () => {
    expect(podeGerirUsuario("supervisor", ["a"], { papel: "gestor", unidades: [] })).toBe(false);
    expect(podeGerirUsuario("supervisor", ["a"], { papel: "supervisor", unidades: ["a"] })).toBe(
      false,
    );
  });
  test("supervisor só gere funcionário de unidade em comum", () => {
    expect(
      podeGerirUsuario("supervisor", ["a"], { papel: "funcionario", unidades: ["a", "b"] }),
    ).toBe(true);
    expect(podeGerirUsuario("supervisor", ["a"], { papel: "funcionario", unidades: ["b"] })).toBe(
      false,
    );
    expect(podeGerirUsuario("supervisor", ["a"], { papel: "funcionario", unidades: [] })).toBe(
      false,
    );
  });
  test("gestor e plataforma gerem a empresa; funcionário não gere ninguém", () => {
    expect(podeGerirUsuario("gestor", "*", { papel: "gestor", unidades: [] })).toBe(true);
    expect(podeGerirUsuario("plataforma", "*", { papel: "funcionario", unidades: [] })).toBe(true);
    expect(podeGerirUsuario("funcionario", ["a"], { papel: "funcionario", unidades: ["a"] })).toBe(
      false,
    );
  });
});

describe("unidades ao editar", () => {
  test("acesso restrito preserva o que está fora do alcance", () => {
    expect(unidadesFinais(["a"], ["a", "b"], [])).toEqual(["b"]);
    expect(unidadesFinais(["a", "c"], ["a", "b"], ["c"])).toEqual(["c", "b"]);
  });
  test("acesso total grava exatamente o pedido", () => {
    expect(unidadesFinais("*", ["a", "b"], ["c"])).toEqual(["c"]);
  });
  test("só o que entra de novo é conferido", () => {
    expect(unidadesAcrescentadas(["a", "b"], ["b", "c"])).toEqual(["c"]);
  });
});

describe("lista", () => {
  const base = {
    ativo: true,
    unidades: ["a"],
    ultimo_acesso: "2026-11-01",
    convitePendente: false,
  };
  const ana = { ...base, nome: "Ana Sá", email: "ana@x.test", papel: "funcionario" as const };
  const gil = { ...base, nome: null, email: "gil@x.test", papel: "gestor" as const, unidades: [] };
  const rui = {
    ...base,
    nome: "Rui",
    email: "rui@x.test",
    papel: "supervisor" as const,
    ativo: false,
  };

  test("situação", () => {
    expect(situacaoUsuario(ana)).toBe("ativo");
    expect(situacaoUsuario(rui)).toBe("inativo");
    expect(situacaoUsuario({ ...ana, ultimo_acesso: null })).toBe("nunca_entrou");
    expect(situacaoUsuario({ ...ana, ultimo_acesso: null, convitePendente: true })).toBe("convite");
  });
  test("busca ignora acento, olha o e-mail e gestor vale em qualquer unidade", () => {
    const lista = [ana, gil, rui];
    expect(filtrarUsuarios(lista, { busca: "SA" }).map((u) => u.email)).toEqual(["ana@x.test"]);
    expect(filtrarUsuarios(lista, { busca: "gil@" })).toHaveLength(1);
    expect(filtrarUsuarios(lista, { unidade: "a" })).toHaveLength(3);
    expect(filtrarUsuarios(lista, { unidade: "z" }).map((u) => u.email)).toEqual(["gil@x.test"]);
    expect(filtrarUsuarios(lista, { papel: "supervisor", situacao: "inativo" })).toEqual([rui]);
  });
});
