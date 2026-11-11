import { describe, expect, test } from "bun:test";
import {
  ehContaEmergencia,
  filtrarUsuariosPlataforma,
  flagsUsuarioPlataforma,
} from "./plataforma-usuarios";

describe("plataforma-usuarios", () => {
  test("filtra por nome ou e-mail", () => {
    const lista = [
      { email: "ana@x.test", nome: "Ana Silva" },
      { email: "bob@x.test", nome: null },
    ];
    expect(filtrarUsuariosPlataforma(lista, "ana").map((u) => u.email)).toEqual(["ana@x.test"]);
    expect(filtrarUsuariosPlataforma(lista, "BOB@").map((u) => u.email)).toEqual(["bob@x.test"]);
    expect(filtrarUsuariosPlataforma(lista, "")).toHaveLength(2);
  });

  test("emergência e remoção", () => {
    expect(ehContaEmergencia("admin@luxbrain.local")).toBe(true);
    expect(ehContaEmergencia("outro@x.test")).toBe(false);
    expect(
      flagsUsuarioPlataforma({
        user_id: "a",
        email: "admin@luxbrain.local",
        euId: "b",
        totalPlataforma: 3,
      }),
    ).toEqual({ eu: false, emergencia: true, podeRemover: false });
    expect(
      flagsUsuarioPlataforma({
        user_id: "a",
        email: "eu@x.test",
        euId: "a",
        totalPlataforma: 3,
      }).podeRemover,
    ).toBe(false);
    expect(
      flagsUsuarioPlataforma({
        user_id: "a",
        email: "outro@x.test",
        euId: "b",
        totalPlataforma: 1,
      }).podeRemover,
    ).toBe(false);
    expect(
      flagsUsuarioPlataforma({
        user_id: "a",
        email: "outro@x.test",
        euId: "b",
        totalPlataforma: 2,
      }).podeRemover,
    ).toBe(true);
  });
});
