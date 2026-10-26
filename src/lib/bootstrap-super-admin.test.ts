import { expect, test } from "bun:test";
import { decidirBootstrap } from "./bootstrap-super-admin";

test("não cria se a conta inicial já existe", () => {
  expect(decidirBootstrap({ contaExiste: true, senhaDefinida: true })).toEqual({
    acao: "recusar",
    motivo: "conta-ja-existe",
  });
  expect(decidirBootstrap({ contaExiste: true, senhaDefinida: false })).toEqual({
    acao: "recusar",
    motivo: "conta-ja-existe",
  });
});

test("não cria se a variável de uso único está ausente", () => {
  expect(decidirBootstrap({ contaExiste: false, senhaDefinida: false })).toEqual({
    acao: "recusar",
    motivo: "senha-ausente",
  });
});

test("cria só na primeira vez, com a variável definida", () => {
  expect(decidirBootstrap({ contaExiste: false, senhaDefinida: true })).toEqual({
    acao: "criar",
  });
});
